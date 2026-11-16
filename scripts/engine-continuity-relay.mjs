// Relay-side trace only: no event interception or extra messages in the Worker.
import { fakeRelay } from './browser-relay.mjs';
export function continuityRelay(history) {
  const started = Date.now(), requests = [], controls = [], filters = [];
  let connection = 0, dropped = 0;
  const at = () => Date.now() - started;
  const record = value => { if (controls.length < 3000) controls.push({ at: at(), ...value }); else dropped++; };
  const relay = fakeRelay({ request(ws, sub, query) {
    for (const f of query) {
      if (filters.length < 1000) filters.push({ kinds: f.kinds, until: f.until, since: f.since, limit: f.limit });
      const events = history.filter(e => (!f.kinds || f.kinds.includes(e.kind)) && (!f.authors || f.authors.includes(e.pubkey)) && (!f.until || e.created_at <= f.until) && (!f.since || e.created_at >= f.since) && !f['#e'])
        .sort((a, b) => b.created_at - a.created_at || b.id.localeCompare(a.id)).slice(0, f.limit ?? 200);
      for (const e of events) ws.send(JSON.stringify(['EVENT', sub, e]));
      if (events.length) ws.send(JSON.stringify(['EVENT', sub, events[0]]));
    }
    ws.send(JSON.stringify(['EOSE', sub])); return true;
  } });
  return {
    filters,
    snapshot: () => ({ startedAt: new Date(started).toISOString(), requests, controls, dropped }),
    route(ws, path) {
      const client = ++connection, pending = new Map();
      record({ t: 'connect', connection: client, path });
      ws.on('close', () => record({ t: 'disconnect', connection: client }));
      relay.route({
        onClose: fn => ws.on('close', fn),
        onMessage: fn => ws.on('message', raw => {
          const m = JSON.parse(String(raw));
          if (m[0] === 'REQ') {
            const entry = { at: at(), connection: client, sub: m[1], filters: m.slice(2), rawEvents: 0, bytes: 0, ids: [], first: null, last: null };
            if (requests.length < 1000) { requests.push(entry); pending.set(m[1], entry); } else dropped++;
            record({ t: 'REQ', connection: client, sub: m[1] });
          } else if (m[0] === 'CLOSE') {
            const entry = pending.get(m[1]); if (entry) entry.closeAt = at();
            pending.delete(m[1]); record({ t: 'CLOSE', connection: client, sub: m[1] });
          }
          fn(raw);
        }),
        send(raw) {
          const m = JSON.parse(raw), entry = pending.get(m[1]);
          if (m[0] === 'EVENT' && entry) {
            entry.rawEvents++; entry.bytes += Buffer.byteLength(raw);
            if (!entry.ids.includes(m[2].id) && entry.ids.length < 1000) entry.ids.push(m[2].id);
            entry.first ??= { id: m[2].id, at: m[2].created_at }; entry.last = { id: m[2].id, at: m[2].created_at };
          } else if (m[0] === 'EOSE') {
            if (entry) entry.eoseAt = at(); record({ t: 'EOSE', connection: client, sub: m[1] });
          }
          ws.send(raw);
        },
      });
    },
  };
}
