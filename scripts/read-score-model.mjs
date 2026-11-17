// Bounded traffic evidence counts every wire frame before identity deduplication.
import { createHash } from 'node:crypto';
export const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const eventHash = event => hash([event.id,event.pubkey,event.created_at,event.kind,event.tags,event.content,event.sig]);
export function createReadScore({ held = [], capEvents = 20000, capBytes = 32 * 1024 * 1024, capFrames = 200000 } = {}) {
  const initial = new Set(held), sockets = new Map(), requests = [], deliveries = [], events = new Map(), seen = new Set(), socketHistory = [];
  const unknown = new Set(), totals = { requests: 0, connections: 0, maxConnections: 0, wireEvents: 0,
    duplicateWireEvents: 0, bytesIn: 0, bytesOut: 0, forbidden: 0, notices: 0, refusals: 0 };
  let bodyBytes = 0, queryBytes = 0, started = false;
  const key = (session, id) => session + ':' + id;
  const finishSocket = (socket, at, reason) => {
    for (const request of socket.active.values()) { request.closedAt ??= at; request.reason ??= reason; }
    socket.active.clear();
  };
  return {
    start() { started = true; },
    stop() { started = false; },
    receive({ method, params: p = {}, sessionId = '', observedAt = Date.now() }) {
      if (!started || !method?.startsWith('Network.webSocket')) return;
      const id = key(sessionId, p.requestId);
      if (method === 'Network.webSocketCreated') {
        totals.connections++;
        if (sockets.size >= 128) { unknown.add('socket-bound'); return; }
        const lifetime={socket:id,relay:p.url,openedAt:observedAt};
        if(socketHistory.length<4096)socketHistory.push(lifetime);else unknown.add('socket-history-bound');
        sockets.set(id, { relay: p.url, active: new Map(), latest: new Map(), lifetime });
        totals.maxConnections = Math.max(totals.maxConnections, sockets.size); return;
      }
      const socket = sockets.get(id);
      if (!socket) { unknown.add('unattributed-socket'); return; }
      if (method === 'Network.webSocketClosed') {
        socket.lifetime.closedAt=observedAt;
        finishSocket(socket, observedAt, 'socket-close'); sockets.delete(id); return;
      }
      const outgoing = method === 'Network.webSocketFrameSent';
      if (!outgoing && method !== 'Network.webSocketFrameReceived') return;
      const payload = p.response?.payloadData;
      if (typeof payload !== 'string') { unknown.add('non-text-frame'); return; }
      const bytes = Buffer.byteLength(payload);
      totals[outgoing ? 'bytesOut' : 'bytesIn'] += bytes;
      if (p.response.opcode !== 1 || bytes > 2 * 1024 * 1024) { unknown.add('frame-bound'); return; }
      let frame;
      try { frame = JSON.parse(payload); } catch { unknown.add('malformed-frame'); return; }
      if (!Array.isArray(frame)) { unknown.add('malformed-frame'); return; }
      const [type, subscription] = frame;
      if (outgoing && !['REQ','CLOSE','COUNT','NEG-OPEN','NEG-MSG','NEG-CLOSE'].includes(type)) {
        totals.forbidden++; unknown.add('write-attempt'); return;
      }
      if (outgoing && type === 'REQ') {
        totals.requests++;
        if (requests.length >= 20000 || queryBytes + bytes > 8 * 1024 * 1024) { unknown.add('request-bound'); return; }
        queryBytes += bytes;
        const prior = socket.active.get(subscription);
        if (prior) { prior.closedAt = observedAt; prior.reason = 'replaced'; }
        const request = { index: requests.length, socket:id, relay: socket.relay, filters: frame.slice(2),
          at: observedAt, subscription, wantedNew: new Set(), received: new Set() };
        requests.push(request); socket.active.set(subscription, request); socket.latest.set(subscription, request);
        return;
      }
      if (outgoing && type === 'CLOSE') {
        const request = socket.active.get(subscription);
        if (request) { request.closedAt = observedAt; request.reason = 'client-close'; }
        socket.active.delete(subscription); return;
      }
      if (outgoing) return;
      if (type === 'NOTICE') { totals.notices++; return; }
      const request = socket.latest.get(subscription);
      if (type === 'CLOSED') {
        totals.refusals++;
        if (request) { request.closedAt = observedAt; request.reason = 'relay-closed'; }
        socket.active.delete(subscription); return;
      }
      if (type === 'EOSE') { if (request) request.eoseAt ??= observedAt; else unknown.add('unattributed-eose'); return; }
      if (type !== 'EVENT') return;
      totals.wireEvents++; // Deliberately before every deduplication and storage bound.
      const event = frame[2];
      if (!/^[0-9a-f]{64}$/.test(event?.id ?? '')) { unknown.add('malformed-event'); return; }
      const identity = event.id + ':' + eventHash(event);
      if (seen.has(identity)) totals.duplicateWireEvents++;
      else if (seen.size < capFrames) seen.add(identity);
      else unknown.add('identity-bound');
      if (!request) unknown.add('unattributed-event');
      if (deliveries.length < capFrames) {
        deliveries.push({ id:event.id, identity, request:request?.index, at:observedAt, bytes });
        request?.received.add(event.id);
      }
      else unknown.add('delivery-bound');
      if (!events.has(identity)) {
        const size = Buffer.byteLength(JSON.stringify(event));
        if (events.size < capEvents && bodyBytes + size <= capBytes) { events.set(identity,event); bodyBytes += size; }
        else unknown.add('event-body-bound');
      }
    },
    bodies() { return [...events.values()]; },
    finish({ verified = [], wanted = [], witness = [], witnessComplete = false, firstScreenMs = null, visibleCompleteMs = null } = {}) {
      const valid = new Set(verified), wantedSet = new Set(wanted), witnessSet = new Set(witness);
      const obtained = new Set(), newIds = new Set();
      let heldWireEvents = 0, unwantedWireEvents = 0, unverifiedWireEvents = 0;
      for (const item of deliveries) {
        if (!valid.has(item.id)) { unverifiedWireEvents++; continue; }
        if (initial.has(item.id)) heldWireEvents++;
        if (!wantedSet.has(item.id)) { unwantedWireEvents++; continue; }
        obtained.add(item.id);
        if (!initial.has(item.id)) {
          newIds.add(item.id);
          if (item.request !== undefined) requests[item.request].wantedNew.add(item.id);
        }
      }
      const witnessed = [...witnessSet].filter(id => obtained.has(id) || initial.has(id)).length;
      const ratio = number => newIds.size ? number / newIds.size : null;
      const completed = requests.filter(r => r.eoseAt !== undefined);
      const metrics = { ...totals, wantedNew: newIds.size, heldWireEvents, unwantedWireEvents, unverifiedWireEvents,
        wastedRequests: completed.filter(r => !r.wantedNew.size).length,
        unansweredRequests: requests.filter(r => r.eoseAt === undefined).length,
        requestsPerWantedNew: ratio(totals.requests), connectionsPerWantedNew:ratio(totals.connections),
        duplicatesPerWantedNew:ratio(totals.duplicateWireEvents), bytesPerWantedNew:ratio(totals.bytesIn+totals.bytesOut) };
      return { schema:'lkjstr-read-score-1', metrics, firstScreenMs, visibleCompleteMs,
        recall:{obtained:witnessed,wanted:witnessSet.size,ratio:witnessSet.size?witnessed/witnessSet.size:null,
          universeKnown:witnessComplete,scope:witnessComplete?'exact-fixture':'verified-public-witnesses; wider universe unknown'},
        complete:unknown.size===0, unknown:[...unknown], capturedBodyBytes:bodyBytes,
        requests:requests.map(({wantedNew,received,...r})=>({...r,wantedNew:wantedNew.size,received:[...received]})),
        socketHistory, deliveries,
        eventIdentitySemantics:'native event fields, object key order ignored; invalid conflicting bodies remain unverified by native helper',
        receivedVerifiedIds:[...obtained].sort(), initialStoreHash:hash([...initial].sort()),
        bounds:{capEvents,capBytes,capFrames}, wireEventCountSemantics:'all EVENT frames including repeated subscription deliveries',
        wastedRequestSemantics:'completed EOSE requests with no verified wanted-new result; support discovery is included'};
    }
  };
}
