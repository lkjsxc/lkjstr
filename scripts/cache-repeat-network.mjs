// Passive, bounded public traffic counters. Event bodies are never retained.
export function repeatNetwork() {
  const phases = {}, clocks = new Map(), requests = new Map();
  let phase, visit, dropped = 0;
  const blank = () => ({ events: 0, receivedBytes: 0, sentBytes: 0, httpBytes: 0, unknownFrames: 0 });
  const count = (field, amount) => { if (phase) phases[phase][field] += amount; };
  const key = (session, id) => session + ':' + id;
  const observe = ({ method, params: p, sessionId, observedAt }) => {
    const id = key(sessionId, p.requestId);
    if (method === 'Network.webSocketWillSendHandshakeRequest') {
      if (clocks.size < 1024) clocks.set(id, { mono: p.timestamp, wall: p.wallTime * 1000 });
      else dropped++;
    } else if (method === 'Network.webSocketClosed') clocks.delete(id);
    else if (method === 'Network.requestWillBeSent') {
      if (requests.size < 8192) requests.set(id, true); else dropped++;
    } else if (method === 'Network.loadingFinished') {
      if (requests.delete(id)) count('httpBytes', p.encodedDataLength ?? 0);
    } else if (method === 'Network.loadingFailed') requests.delete(id);
    else if (['Network.webSocketFrameReceived', 'Network.webSocketFrameSent'].includes(method)) {
      const incoming = method.endsWith('Received'), frame = p.response ?? {};
      const raw = frame.payloadData ?? '', bytes = frame.opcode === 2
        ? Buffer.from(raw, 'base64').length : Buffer.byteLength(raw);
      let type, eventId;
      if (frame.opcode === 1 && raw.length <= 2 * 1024 * 1024) {
        try {
          const value = JSON.parse(raw);
          if (Array.isArray(value)) { type = value[0]; eventId = type === 'EVENT' ? value[2]?.id : undefined; }
        } catch { /* Malformed incoming data cannot prove a cache hit. */ }
      }
      count(incoming ? 'receivedBytes' : 'sentBytes', bytes);
      if (incoming && type === 'EVENT') count('events', 1);
      if (incoming && !type) count('unknownFrames', 1);
      if (!visit) return;
      const clock = clocks.get(id), exact = clock && Number.isFinite(p.timestamp) && Number.isFinite(clock.wall);
      const row = { at: exact ? clock.wall + (p.timestamp - clock.mono) * 1000 : observedAt,
        clock: exact ? 'cdp-monotonic' : 'host-observed', incoming, bytes,
        event: incoming && type === 'EVENT', unknown: incoming && !type };
      if (/^[0-9a-f]{64}$/.test(eventId ?? '')) row.eventId = eventId;
      if (visit.frames.length < 20000) visit.frames.push(row);
      else visit.dropped++;
    }
  };
  return {
    observe,
    beginPhase(name) {
      if (!['first', 'repeat'].includes(name)) throw Error('Unknown cache-repeat phase');
      phase = name; phases[name] = blank();
    },
    endPhase() { phase = undefined; },
    beginVisit(id) { visit = { id, frames: [], dropped: 0 }; },
    endVisit(startedAt, endedAt, paintedAt) {
      const value = visit; visit = undefined;
      const frames = (value?.frames ?? []).filter(row => row.at >= startedAt && row.at <= endedAt);
      const before = frames.filter(row => row.at <= paintedAt);
      // A host-observed frame can be delivered after paint even when the browser received it before paint.
      const uncertain = (value?.frames ?? []).some(row => row.incoming && row.clock !== 'cdp-monotonic') ||
        before.some(row => row.incoming && row.unknown);
      return { events: frames.filter(row => row.event).length,
        receivedBytes: frames.filter(row => row.incoming).reduce((n, row) => n + row.bytes, 0),
        sentBytes: frames.filter(row => !row.incoming).reduce((n, row) => n + row.bytes, 0),
        eventsBeforePaint: Number.isFinite(paintedAt) ? before.filter(row => row.event).length : null,
        repliesBeforePaint: Number.isFinite(paintedAt) ? before.filter(row => row.incoming).length : null,
        cacheOrigin: !Number.isFinite(paintedAt) || value?.dropped || dropped || uncertain ? 'unknown'
          : before.some(row => row.event) ? 'relay-overlap' : 'before-relay-event',
        firstEventEpoch: frames.find(row => row.event)?.at ?? null,
        receivedIdsBeforePaint: before.filter(row => row.event && row.eventId).map(row => row.eventId).slice(0, 32),
        dropped: value?.dropped ?? 0, attribution: 'All measured application targets during the visit, including background traffic' };
    },
    summary() { return structuredClone({ phases, dropped }); },
  };
}
