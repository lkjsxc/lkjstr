import init, { start_shared } from './lkjstr_engine.js';
const queued = [];
self.onconnect = (event) => queued.push(event);
await init();
self.engineHandle = start_shared();
for (const event of queued) self.onconnect(event);
