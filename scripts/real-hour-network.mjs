// Host-side CDP evidence: parse public frames outside the measured page/Worker.
// Bounds cover retained query JSON and delivery metadata; bodies are never retained.
import { createHash } from 'node:crypto';
export const eventDigest = (event) => createHash('sha256')
  .update(JSON.stringify([event.id, event.pubkey, event.created_at, event.kind, event.tags, event.content, event.sig]))
  .digest('hex');
export function createNetworkEvidence(limits = {}) {
  const cap = { sockets: 128, queries: 10000, queryBytes: 64 * 1024 * 1024,
    deliveries: 100000, deliveryBytes: 32 * 1024 * 1024, ...limits };
  const sockets = new Map(), queries = [], deliveries = [], seen = new Set(), targets = new Map();
  const dropped = { sockets: 0, queries: 0, deliveries: 0, frames: 0, unattributed: 0 };
  let serial = 0, queryBytes = 0, deliveryBytes = 0, forbidden = 0;
  const key = (session, request) => JSON.stringify([session, request]);
  const close = (socket, at, reason) => {
    for (const query of socket.active.values()) { query.closedAt ??= at; query.closeReason ??= reason; }
    socket.active.clear();
  };
  const stamp = (socket, params, observedAt) => {
    if (socket.clock && Number.isFinite(params.timestamp))
      return { at: socket.clock.wall + (params.timestamp - socket.clock.monotonic) * 1000,
        clock: 'browser-monotonic' };
    return { at: observedAt, clock: 'host-observed' };
  };
  function frame(socket, params, outgoing, observedAt) {
    const payload = params.response?.payloadData;
    if (params.response?.opcode !== 1 || typeof payload !== 'string' || payload.length > 2 * 1024 * 1024) {
      dropped.frames++; return;
    }
    let message;
    try { message = JSON.parse(payload); } catch { dropped.frames++; return; }
    if (!Array.isArray(message)) { dropped.frames++; return; }
    const [type, sub] = message, time = stamp(socket, params, observedAt);
    if (outgoing && !['REQ', 'CLOSE'].includes(type)) { forbidden++; return; }
    if (!['REQ', 'CLOSE', 'EOSE', 'CLOSED', 'EVENT'].includes(type)) return;
    if (typeof sub !== 'string' || sub.length > 1024) { dropped.frames++; return; }
    const previous = socket.latest.get(sub);
    if (outgoing && (type === 'REQ' || type === 'CLOSE')) {
      if (previous) { previous.closedAt ??= time.at; previous.closeReason ??= type === 'REQ' ? 'replaced' : 'client-close'; }
      socket.active.delete(sub);
      if (type === 'CLOSE') return;
      socket.latest.delete(sub); // An unrecorded replacement must not inherit the old route.
      const filters = message.slice(2);
      if (!filters.length || filters.some(filter => !filter || Array.isArray(filter) || typeof filter !== 'object')) {
        dropped.frames++; return;
      }
      const bytes = Buffer.byteLength(JSON.stringify(filters));
      if (queries.length >= cap.queries || queryBytes + bytes > cap.queryBytes || socket.active.size >= 128) {
        dropped.queries++; return;
      }
      const query = { index: queries.length, ...time, relay: socket.relay, subscription: sub,
        socket: socket.serial, targetType: socket.type, filters };
      queries.push(query); socket.active.set(sub, query); socket.latest.set(sub, query); queryBytes += bytes;
      return;
    }
    if (outgoing) return;
    if (type === 'EOSE') { if (previous) previous.eoseAt ??= time.at; else dropped.unattributed++; return; }
    if (type === 'CLOSED') {
      if (previous) { previous.closedAt ??= time.at; previous.closeReason ??= 'relay-closed'; }
      socket.active.delete(sub); return;
    }
    if (type !== 'EVENT') return;
    const id = message[2]?.id;
    if (typeof id !== 'string' || !/^[0-9a-f]{64}$/.test(id)) { dropped.frames++; return; }
    if (!previous) { dropped.unattributed++; return; }
    const digest = eventDigest(message[2]);
    const identity = previous.index + ':' + id + ':' + digest;
    if (seen.has(identity)) return;
    const item = { id, digest, ...time, query: previous.index };
    const bytes = Buffer.byteLength(identity) + Buffer.byteLength(JSON.stringify(item));
    if (deliveries.length >= cap.deliveries || deliveryBytes + bytes > cap.deliveryBytes) {
      dropped.deliveries++; return;
    }
    seen.add(identity); deliveries.push(item); deliveryBytes += bytes;
  }
  return {
    target(session, type, enabled) {
      if (targets.size >= 128 && !targets.has(session)) { dropped.sockets++; return; }
      targets.set(session, { sent: 0, received: 0, probeSent: 0, probeReceived: 0,
        sampled: false, reset: false, ...targets.get(session), type, enabled: Boolean(enabled) });
    },
    observeProbe(session, probe, bootstrap) {
      const target = targets.get(session);
      if (!target) return;
      target.bootstrapped = !target.type.includes('worker') || Boolean(bootstrap?.phase === 'imported'
        && bootstrap.guardBeforeImport && bootstrap.hostReadyBeforeImport
        && Number.isFinite(bootstrap.releasedAt) && Number.isFinite(bootstrap.importedAt));
      target.sampled = Boolean(probe && Number.isFinite(probe.started)
        && Number.isSafeInteger(probe.sent) && probe.sent >= 0
        && Number.isSafeInteger(probe.received) && probe.received >= 0);
      if (!target.sampled) return;
      if (target.epoch !== undefined && target.epoch !== probe.started) {
        target.reset = true; // A vanished epoch may have an unobserved tail.
        target.priorSent = (target.priorSent ?? 0) + target.lastSent;
        target.priorReceived = (target.priorReceived ?? 0) + target.lastReceived;
        target.lastSent = target.lastReceived = 0;
      }
      target.epoch = probe.started;
      target.lastSent = Math.max(target.lastSent ?? 0, probe.sent);
      target.lastReceived = Math.max(target.lastReceived ?? 0, probe.received);
      target.probeSent = (target.priorSent ?? 0) + target.lastSent;
      target.probeReceived = (target.priorReceived ?? 0) + target.lastReceived;
    },
    detach(session, observedAt = Date.now()) {
      for (const [id, socket] of sockets) if (socket.session === session) {
        close(socket, observedAt, 'target-detached'); sockets.delete(id);
      }
    },
    receive(message, observedAt = Date.now()) {
      const { method, params = {}, sessionId: session } = message;
      if (!method?.startsWith('Network.webSocket')) return;
      const target = targets.get(session);
      if (target && method === 'Network.webSocketFrameSent') target.sent++;
      if (target && method === 'Network.webSocketFrameReceived') target.received++;
      const id = key(session, params.requestId);
      if (method === 'Network.webSocketCreated') {
        if (sockets.size >= cap.sockets || typeof params.url !== 'string' || params.url.length > 4096) {
          dropped.sockets++; return;
        }
        sockets.set(id, { session, relay: params.url, type: targets.get(session)?.type,
          serial: ++serial, active: new Map(), latest: new Map() });
        return;
      }
      const socket = sockets.get(id);
      if (!socket) { dropped.unattributed++; return; }
      if (method === 'Network.webSocketWillSendHandshakeRequest') {
        if (Number.isFinite(params.wallTime) && Number.isFinite(params.timestamp))
          socket.clock = { wall: params.wallTime * 1000, monotonic: params.timestamp };
      } else if (method === 'Network.webSocketFrameSent') frame(socket, params, true, observedAt);
      else if (method === 'Network.webSocketFrameReceived') frame(socket, params, false, observedAt);
      else if (method === 'Network.webSocketClosed') {
        close(socket, stamp(socket, params, observedAt).at, 'socket-close'); sockets.delete(id);
      }
    },
    summary() {
      const relevant = [...targets.values()].filter(t => ['page', 'worker', 'shared_worker'].includes(t.type));
      return { source: 'host-CDP', complete: relevant.length > 0 && relevant.every(t => t.enabled && t.sampled && t.bootstrapped && !t.reset
          && t.sent >= t.probeSent && t.received >= t.probeReceived)
          && !Object.values(dropped).some(Boolean) && forbidden === 0,
        targets: relevant, activeSockets: sockets.size, queries: queries.length, queryBytes,
        deliveries: deliveries.length, deliveryBytes, dropped: { ...dropped }, forbidden, bounds: cap };
    },
    queries: () => queries,
    forEvent(id) { return deliveries.filter(item => item.id === id).map(item => ({ ...item, request: queries[item.query] })); },
    snapshot() { return { summary: this.summary(), queries, deliveries }; },
  };
}
