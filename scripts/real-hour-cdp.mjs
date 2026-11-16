// Raw CDP is used only to observe/instrument this harness's own Chromium targets.
import bundle from 'playwright-core/lib/utilsBundle';
import { observeRelease } from './real-hour-observe.mjs';
const injected = `(${observeRelease.toString()})()`;
export async function attachBrowser(endpoint, { wasmModule } = {}) {
  const socket = new bundle.ws(endpoint);
  const pending = new Map(), sessions = new Map(), errors = [], debuggerEvents = [];
  let next = 0, online = true;
  const send = (method, params = {}, sessionId, timeoutMs = 20000) => new Promise((resolve, reject) => {
    const id = ++next;
    const timer = setTimeout(() => { pending.delete(id); reject(Error(`CDP timeout: ${method}`)); }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  socket.on('message', async (raw) => {
    const message = JSON.parse(String(raw));
    if (message.id) {
      const task = pending.get(message.id);
      if (!task) return;
      pending.delete(message.id); clearTimeout(task.timer);
      if (message.error) task.reject(Error(message.error.message)); else task.resolve(message.result);
    } else if (message.method === 'Target.attachedToTarget') {
      const { sessionId, targetInfo } = message.params;
      if (!['page', 'worker', 'shared_worker', 'service_worker'].includes(targetInfo.type)
          || [...sessions.values()].some((target) => target.targetId === targetInfo.targetId)) {
        await send('Target.detachFromTarget', { sessionId }).catch(() => {});
        return;
      }
      sessions.set(sessionId, targetInfo);
      let secured = false;
      try {
        if (targetInfo.type === 'service_worker') throw Error('Service Worker unexpectedly executed despite blocked capability');
        await send('Runtime.enable', {}, sessionId, 3000);
        if (targetInfo.type === 'page') {
          await send('Page.enable', {}, sessionId);
          await send('Page.addScriptToEvaluateOnNewDocument', { source: injected }, sessionId);
        }
        const installed = await send('Runtime.evaluate', { expression: `${injected};Boolean(globalThis.__realHour && globalThis.__realHourNetwork)`, returnByValue: true }, sessionId, 3000);
        if (installed.exceptionDetails || installed.result?.value !== true) throw Error('Read-only guard installation failed');
        if (!online) {
          await send('Runtime.evaluate', { expression: 'globalThis.__realHourNetwork(false)' }, sessionId);
          await send('Network.enable', {}, sessionId);
          await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, sessionId);
        }
        await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }, sessionId);
        secured = true; targetInfo.guardInstalled = true;
      } catch (error) { if (errors.length < 20) errors.push(String(error)); }
      finally {
        if (secured) {
          await send('Runtime.runIfWaitingForDebugger', {}, sessionId, 2000).catch(() => {});
        }
        else await send('Target.closeTarget', { targetId: targetInfo.targetId }).catch(() => {});
      }
    } else if (message.method === 'Target.detachedFromTarget') sessions.delete(message.params.sessionId);
    else if (['Debugger.paused', 'Debugger.resumed'].includes(message.method)) {
      if (debuggerEvents.length >= 100) debuggerEvents.shift();
      debuggerEvents.push({ method: message.method, session: message.sessionId, at: Date.now(), reason: message.params?.reason });
    }
  });
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
  await send('Target.setDiscoverTargets', { discover: true });
  await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
  const targets = (await send('Target.getTargets')).targetInfos;
  for (const target of targets.filter((t) => t.type === 'page' && !t.attached))
    await send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  const evaluate = async (session, expression, timeoutMs = 20000) => {
    const value = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, session, timeoutMs);
    if (value.exceptionDetails) throw Error(value.exceptionDetails.text);
    return value.result.value;
  };
  return {
    sessions, errors, debuggerEvents, send, evaluate,
    guardStatus() { return [...sessions.values()].map((target) => ({ type: target.type, id: target.targetId, installed: Boolean(target.guardInstalled) })); },
    async sample() {
      const out = [];
      for (const [session, target] of sessions) {
        if (!['page', 'worker', 'shared_worker'].includes(target.type)) continue;
        try {
          const wasmLinearBytes = wasmModule && target.type.includes('worker')
            ? await evaluate(session, `(async()=>{if(!globalThis.engineHandle)return null;const m=await import(new URL(${JSON.stringify(wasmModule)},location.href).href);return (await m.default()).memory.buffer.byteLength})()`, 2000).catch(() => null) : null;
          out.push({ type: target.type, url: target.url, wasmLinearBytes, heap: await send('Runtime.getHeapUsage', {}, session, 2000),
            probe: await evaluate(session, 'globalThis.__realHourSnapshot?.()', 2000) });
        } catch (error) { out.push({ type: target.type, error: String(error) }); }
      }
      return out;
    },
    async network(nextOnline) {
      online = nextOnline;
      const results = [];
      for (const [session, target] of sessions) {
        try {
          await send('Network.enable', {}, session, 2000);
          await send('Network.emulateNetworkConditions', { offline: !online, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, session, 2000);
          results.push({ type: target.type, networkEmulation: true });
        } catch (error) { results.push({ type: target.type, networkEmulation: false, error: String(error) }); }
        await evaluate(session, `globalThis.__realHourNetwork?.(${online})`, 2000).catch(() => {});
      }
      return results;
    },
    async queries() {
      const all = [];
      for (const [session, target] of sessions) if (target.type.includes('worker'))
        all.push(...await evaluate(session, 'globalThis.__realHour?.queries ?? []').catch(() => []));
      return all;
    },
    async close() {
      for (const task of pending.values()) { clearTimeout(task.timer); task.reject(Error('CDP closed')); }
      pending.clear(); socket.close();
    },
  };
}
