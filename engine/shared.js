// Loading WASM can outlast the runtime watchdog on a thin connection.
import init, { start_shared } from './lkjstr_engine.js';
const queued = []; // At most 32 ports, matching the host's client bound.
let waiting = 0;
const alive = () => {
  for (const event of queued) for (const port of event.ports) port.postMessage({ t: 'heartbeat' });
};
self.onconnect = (event) => {
  if (!event.ports.length || waiting + event.ports.length > 32) {
    for (const port of event.ports) port.close();
    return;
  }
  waiting += event.ports.length;
  queued.push(event);
  for (const port of event.ports) port.postMessage({ t: 'heartbeat' });
};
const timer = setInterval(alive, 10000);
let expired = false, timeout;
const deadline = new Promise((_, reject) => {
  timeout = setTimeout(() => {
    expired = true;
    reject(new Error('engine startup timed out'));
  }, 15 * 60000);
});
try {
  await Promise.race([init(), deadline]);
  self.engineHandle = start_shared();
  for (const event of queued.splice(0)) self.onconnect(event);
} catch (error) {
  for (const event of queued.splice(0)) for (const port of event.ports) port.close();
  if (expired) self.close();
  throw error;
} finally {
  clearInterval(timer);
  clearTimeout(timeout);
}
