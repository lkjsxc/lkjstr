// Passive target-wide byte accounting. No request routing, disabled cache or release-byte rewriting.
import { createHash } from 'node:crypto';
import { routeProbeUrl } from './race-route.mjs';
import { throttlePhone } from './race-phone.mjs';
import bundle from 'playwright-core/lib/utilsBundle';
export async function attachRace(endpoint, mobile = false) {
  const socket = new bundle.ws(endpoint), pending = new Map(), sessions = new Map(), errors = [], requests = new Map();
  const totals = { httpTransferredBytes: 0, httpDecodedBytes: 0, websocketReceivedPayloadBytes: 0,
    websocketSentPayloadBytes: 0, relayEvents: 0, forbiddenSentFrames: 0, diskCacheResponses: 0, serviceWorkerResponses: 0 };
  const targets = [], relayUrls = new Set(), routeResponses = [], listeners = new Set(), ruleApplications = new Map();
  let next = 0, navigationEpoch = 0;
  const send = (method, params = {}, sessionId, timeoutMs = 5000) => new Promise((resolve, reject) => {
    const id = ++next, timer = setTimeout(() => { pending.delete(id); reject(Error('CDP timeout ' + method)); }, timeoutMs);
    pending.set(id, { resolve, reject, timer, method });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  socket.on('message', async raw => {
    const message = JSON.parse(String(raw)), data = message.params ?? {}, sessionId = message.sessionId;
    if (message.id) {
      const task = pending.get(message.id); if (!task) return;
      pending.delete(message.id); clearTimeout(task.timer);
      if (message.error) task.reject(Error(task.method + ': ' + message.error.message)); else task.resolve(message.result);
      return;
    }
    if (message.method === 'Target.attachedToTarget') {
      const id = data.sessionId, target = data.targetInfo;
      if (!['page', 'worker', 'shared_worker', 'service_worker'].includes(target.type)) return;
      if ([...sessions.values()].some(item => item.targetId === target.targetId)) return;
      sessions.set(id, target); const witness = { type: target.type, url: target.url, at: Date.now() }; targets.push(witness);
      try {
        // Chrome cannot answer a SW Network.enable while its initial context is paused.
        if (target.type === 'service_worker') await send('Runtime.runIfWaitingForDebugger', {}, id);
        await send('Network.enable', {}, id);
        await send('Runtime.enable', {}, id);
        if (mobile) witness.mobile = await throttlePhone(send, id, target.type);
        await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }, id);
      } catch (error) { if (errors.length < 30) errors.push(target.type + ': ' + String(error)); }
      finally {
        if (target.type !== 'service_worker') await send('Runtime.runIfWaitingForDebugger', {}, id).catch(error => { if (errors.length < 30) errors.push(String(error)); });
        witness.networkReadyDelayMs = Date.now() - witness.at;
      }
      return;
    }
    if (message.method === 'Target.detachedFromTarget') { sessions.delete(data.sessionId); return; }
    if (message.method.startsWith('Network.') && listeners.size) {
      const event = { method: message.method, params: data, sessionId, observedAt: Date.now() };
      for (const listener of listeners) try { listener(event); }
      catch (error) { if (errors.length < 30) errors.push('Network observer: ' + String(error)); }
    }
    if (!navigationEpoch) return;
    if (message.method === 'Network.requestWillBeSentExtraInfo' && data.appliedNetworkConditionsId) {
      const key = sessionId + ':' + data.appliedNetworkConditionsId;
      if (!ruleApplications.has(key) && ruleApplications.size < 128) ruleApplications.set(key, {
        targetType: sessions.get(sessionId)?.type ?? 'detached', ruleId: data.appliedNetworkConditionsId, requests: 0 });
      const rule = ruleApplications.get(key);
      if (rule) rule.requests++; else totals.droppedRuleApplications = (totals.droppedRuleApplications ?? 0) + 1;
    }
    const key = data.requestId;
    if (message.method === 'Network.requestWillBeSent') {
      if (requests.size < 10000 && !requests.has(key)) requests.set(key, { type: data.type, url: data.request.url, done: false });
    } else if (message.method === 'Network.responseReceived') {
      const row = requests.get(key), response = data.response;
      if (row) {
        row.disk = response.fromDiskCache; row.sw = response.fromServiceWorker;
        if (response.url === routeProbeUrl && routeResponses.length < 8) routeResponses.push({
          requestId: key, sessionId, url: response.url, status: response.status, protocol: response.protocol,
          remoteIp: response.remoteIPAddress, remotePort: response.remotePort, fromDiskCache: row.disk,
          fromServiceWorker: row.sw, tlsProtocol: response.securityDetails?.protocol });
        if (row.type === 'Document' && !totals.document) totals.document = {
          status: response.status, url: response.url, protocol: response.protocol, headers: response.headers };
      }
    } else if (message.method === 'Network.loadingFinished') {
      const row = requests.get(key);
      if (row && !row.done) {
        row.done = true; totals.httpTransferredBytes += row.disk ? 0 : data.encodedDataLength;
        if (row.disk) totals.diskCacheResponses++; if (row.sw) totals.serviceWorkerResponses++;
      }
    } else if (message.method === 'Network.dataReceived') totals.httpDecodedBytes += data.dataLength ?? 0;
    else if (message.method === 'Network.webSocketCreated') relayUrls.add(data.url);
    else if (message.method === 'Network.webSocketFrameReceived') {
      const payload = data.response?.payloadData ?? '';
      totals.firstRelayReplyEpoch ??= Date.now();
      totals.websocketReceivedPayloadBytes += Buffer.byteLength(payload);
      if (/^\s*\[\s*"EVENT"\s*,/.test(payload)) {
        totals.relayEvents++; totals.firstRelayEventEpoch ??= Date.now();
      }
    } else if (message.method === 'Network.webSocketFrameSent') {
      const payload = data.response?.payloadData ?? '';
      totals.websocketSentPayloadBytes += Buffer.byteLength(payload);
      try {
        const frame = JSON.parse(payload);
        if (!Array.isArray(frame) || !['REQ', 'CLOSE', 'COUNT', 'NEG-OPEN', 'NEG-MSG', 'NEG-CLOSE'].includes(frame[0]))
          totals.forbiddenSentFrames++;
      } catch { totals.forbiddenSentFrames++; }
    }
  });
  await new Promise((done, reject) => { socket.once('open', done); socket.once('error', reject); });
  await send('Target.setDiscoverTargets', { discover: true });
  await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
  return {
    errors, send,
    listenNetwork(listener) {
      if (typeof listener !== 'function' || listeners.size >= 8) throw Error('A network listener is required; maximum eight');
      listeners.add(listener); return () => listeners.delete(listener);
    },
    start() { navigationEpoch = Date.now(); },
    stop() { navigationEpoch = 0; },
    async sample() {
      const guards = [];
      for (const [id, target] of sessions) if (target.type !== 'service_worker') {
        try {
          const result = await send('Runtime.evaluate', { expression: 'globalThis.__openRaceGuard ?? null', returnByValue: true }, id);
          guards.push({ type: target.type, guard: result.result?.value ?? null });
        } catch (error) { guards.push({ type: target.type, error: String(error) }); }
      }
      const routeWitnesses = [];
      for (const { requestId, sessionId, ...response } of routeResponses) {
        try {
          const result = await send('Network.getResponseBody', { requestId }, sessionId);
          const body = Buffer.from(result.body, result.base64Encoded ? 'base64' : 'utf8');
          response.bytes = body.length; response.sha256 = createHash('sha256').update(body).digest('hex');
        } catch { response.bodyUnavailable = true; }
        routeWitnesses.push(response);
      }
      return { ...totals, requests: requests.size, routeWitnesses,
        assets: [...requests.values()].filter(row => ['Script', 'Stylesheet', 'Font'].includes(row.type) || /\.wasm(?:\?|$)/.test(row.url)).map(row => row.url).slice(0, 512),
        targets, networkRuleApplications: [...ruleApplications.values()], relayUrls: [...relayUrls], guards, errors: [...errors],
        payloadBytesNote: 'WebSocket UTF-8 message payload, excluding framing/TLS/compression; HTTP encoded bytes from CDP loadingFinished' };
    },
    async close() {
      for (const item of pending.values()) { clearTimeout(item.timer); item.reject(Error('Race CDP closed')); }
      pending.clear(); listeners.clear(); socket.close();
    },
  };
}
