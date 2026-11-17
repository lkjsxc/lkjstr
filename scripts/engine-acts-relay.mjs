// In-memory bounded relay for owned signed fixtures; no upstream connection.
export function matchesActFilter(event, filter) {
  return (!filter.ids || filter.ids.some(id => event.id.startsWith(id)))
    && (!filter.authors || filter.authors.some(key => event.pubkey.startsWith(key)))
    && (!filter.kinds || filter.kinds.includes(event.kind))
    && (filter.since === undefined || event.created_at >= filter.since)
    && (filter.until === undefined || event.created_at <= filter.until)
    && Object.entries(filter).filter(([key]) => key.startsWith('#')).every(([key, values]) =>
      event.tags.some(tag => tag[0] === key.slice(1) && values.includes(tag[1])));
}
export function actsRelay(data, now = Date.now) {
  const catalog = new Map(data.catalog.map(event => [event.id, event]));
  const visible = new Set(data.initial.map(event => event.id)), sockets = new Map();
  const modes = new Map([[data.pendingNote.id, 'held'], [data.missingId, 'missing'], [data.failedId, 'failed']]);
  const requests = [], errors = []; let queryBytes = 0, forbidden = 0;
  const failure = (socket, reason) => { if (errors.length < 20) errors.push(reason); socket.close(); };
  const send = (socket, entry, event) => {
    if (socket.readyState !== 1 || entry.ids.includes(event.id)) return;
    socket.send(JSON.stringify(['EVENT', entry.wire, event])); entry.ids.push(event.id);
  };
  const finish = (socket, entry) => {
    if (socket.readyState !== 1 || entry.eoseAt !== undefined) return;
    socket.send(JSON.stringify(['EOSE', entry.wire])); entry.eoseAt = now();
  };
  function connection(socket) {
    if (sockets.size >= 8) return failure(socket, 'owned socket bound');
    const active = new Map(); sockets.set(socket, active);
    socket.on('close', () => {
      for (const entry of active.values()) { entry.closedAt ??= now(); entry.closeReason ??= 'socket-close'; }
      sockets.delete(socket);
    });
    socket.on('message', raw => {
      let message;
      try { if (raw.length > 128 * 1024) throw Error(); message = JSON.parse(String(raw)); }
      catch { return failure(socket, 'malformed or oversized owned frame'); }
      if (!Array.isArray(message) || !['REQ', 'CLOSE'].includes(message[0])) {
        forbidden++; return failure(socket, 'forbidden publication or authorization');
      }
      const wire = message[1];
      if (typeof wire !== 'string' || wire.length > 256) return failure(socket, 'wire id bound');
      const old = active.get(wire);
      if (old) { old.closedAt = now(); old.closeReason = message[0] === 'CLOSE' ? 'client-close' : 'replaced'; active.delete(wire); }
      if (message[0] === 'CLOSE') return;
      const filters = message.slice(2), bytes = Buffer.byteLength(JSON.stringify(filters));
      if (!filters.length || filters.some(filter => !filter || typeof filter !== 'object' || Array.isArray(filter)))
        return failure(socket, 'invalid filter');
      if (requests.length >= 512 || queryBytes + bytes > 2 * 1024 * 1024 || active.size >= 32)
        return failure(socket, 'owned query evidence bound');
      queryBytes += bytes;
      const entry = { wire, filters, at: now(), ids: [] }; requests.push(entry); active.set(wire, entry);
      const ids = filters.flatMap(filter => filter.ids ?? []);
      if (ids.includes(data.failedId)) {
        socket.send(JSON.stringify(['CLOSED', wire, 'error: owned lookup fixture refusal']));
        entry.closedAt = now(); entry.closeReason = 'relay-closed'; active.delete(wire); return;
      }
      let held = false;
      for (const filter of filters) {
        const candidates = [...catalog.values()].filter(event => (filter.ids || visible.has(event.id)) && matchesActFilter(event, filter))
          .sort((a, b) => b.created_at - a.created_at || b.id.localeCompare(a.id))
          .slice(0, Math.min(filter.limit ?? 200, 200));
        for (const event of candidates) {
          if (modes.get(event.id) === 'held') { held = true; continue; }
          if (!['missing', 'failed'].includes(modes.get(event.id))) send(socket, entry, event);
        }
      }
      if (!held) finish(socket, entry);
    });
  }
  const add = events => {
    for (const event of events) {
      if (!catalog.has(event.id)) throw Error('unowned fixture event');
      visible.add(event.id);
      for (const [socket, active] of sockets) for (const entry of active.values())
        if (entry.filters.some(filter => matchesActFilter(event, filter)) && !modes.has(event.id)) send(socket, entry, event);
    }
  };
  return { connection, requests, errors,
    get forbidden() { return forbidden; }, get sockets() { return sockets.size; },
    get active() { return [...sockets.values()].reduce((sum, active) => sum + active.size, 0); },
    add,
    release(id) {
      if (modes.get(id) !== 'held') throw Error('only a held fixture note can be released');
      modes.delete(id); const event = catalog.get(id); add([event]);
      for (const [socket, active] of sockets) for (const entry of active.values())
        if (entry.filters.some(filter => matchesActFilter(event, filter))) finish(socket, entry);
    },
    close() { for (const socket of sockets.keys()) socket.terminate(); sockets.clear(); },
  };
}
