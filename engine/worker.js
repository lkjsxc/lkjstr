// Buffer transferred ports until WASM owns the host.
import init, { start_port_host } from './lkjstr_engine.js';
const queued = [];
self.onmessage = (event) => queued.push(event);
await init();
self.engineHandle = start_port_host();
for (const event of queued) self.onmessage(event);
