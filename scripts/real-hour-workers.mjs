// Measurement-only module-worker bootstrap; original release resources stay byte-identical.
import { observeRelease } from './real-hour-observe.mjs';
export const WORKER_MARK = '__lkjstr_measure_worker';
export const WORKER_SOURCE = '__lkjstr_measure_source';
export function installWorkerBootstrap({ origin, base } = {}) {
  if (globalThis.__realHourWorkerConstructors) return;
  globalThis.__realHourWorkerConstructors = true;
  const owner = origin ?? location.origin;
  for (const name of ['Worker', 'SharedWorker']) {
    const Native = globalThis[name];
    if (!Native) continue;
    globalThis[name] = new Proxy(Native, { construct(target, args, newTarget) {
      const source = new URL(String(args[0]), base ?? globalThis.document?.baseURI ?? location.href);
      const type = args[1] && typeof args[1] === 'object' ? args[1].type : undefined;
      if (type !== 'module' || source.origin !== owner || !['http:', 'https:'].includes(source.protocol))
        throw new Error('Measured workers require a same-origin module URL');
      if (source.searchParams.has('__lkjstr_measure_worker') || source.searchParams.has('__lkjstr_measure_source'))
        throw new Error('Reserved measured-worker URL');
      const wrapped = new URL(source);
      wrapped.searchParams.set('__lkjstr_measure_worker', 'module');
      wrapped.searchParams.set('__lkjstr_measure_source', source.href);
      return Reflect.construct(target, [wrapped.href, ...args.slice(1)], newTarget);
    } });
  }
}
export function workerBootstrap(request, base) {
  if (!request.searchParams.has(WORKER_MARK)) return null;
  const source = new URL(request.searchParams.get(WORKER_SOURCE) ?? '', base);
  if (request.searchParams.get(WORKER_MARK) !== 'module' || source.origin !== base
      || source.pathname !== request.pathname || source.searchParams.has(WORKER_MARK)
      || source.searchParams.has(WORKER_SOURCE)) throw Error('Invalid measured-worker URL');
  return `(${observeRelease.toString()})();
(${installWorkerBootstrap.toString()})(${JSON.stringify({ origin: base, base: source.href })});
const boundary=globalThis.__realHourWorkerBootstrap={phase:'waiting',source:${JSON.stringify(source.href)},
  enteredAt:Date.now(),waited:!globalThis.__realHourHostReady,guardBeforeImport:false,hostReadyBeforeImport:false};
const queued=[];
let fail,failure;
const abort=error=>{failure=error;boundary.phase='failed';
  for(const event of queued.splice(0))for(const port of event.ports??[])port.close();
  fail?.(error);self.close();};
const kind=typeof SharedWorkerGlobalScope==='undefined'?'message':'connect';
const capture=event=>{
  event.stopImmediatePropagation();
  if(queued.length>=128){for(const port of event.ports??[])port.close();abort(Error('Measured worker startup queue full'));return;}
  queued.push(event);
};
self.addEventListener(kind,capture);
try {
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Measured worker guard was not released')),10000);
    fail=error=>{clearTimeout(timer);reject(error);};
    globalThis.__realHourWorkerRelease=()=>{
      if(!globalThis.__realHourHostReady)return;
      clearTimeout(timer);resolve();
    };
    if(globalThis.__realHourHostReady)globalThis.__realHourWorkerRelease();
  });
  if(failure)throw failure;
  boundary.guardBeforeImport=Boolean(globalThis.__realHour&&globalThis.__realHourNetwork);
  boundary.hostReadyBeforeImport=globalThis.__realHourHostReady===true;
  if(!boundary.guardBeforeImport||!boundary.hostReadyBeforeImport)throw Error('Measured worker guard unavailable');
  boundary.phase='released';boundary.releasedAt=Date.now();
  await import(${JSON.stringify(source.href)});
  if(failure)throw failure;
  self.removeEventListener(kind,capture);
  boundary.phase='imported';boundary.importedAt=Date.now();boundary.queued=queued.length;
  for(const event of queued.splice(0))self.dispatchEvent(new MessageEvent(kind,{data:event.data,
    origin:event.origin,lastEventId:event.lastEventId,source:event.source,ports:event.ports}));
} catch(error) {
  boundary.phase='failed';
  for(const event of queued.splice(0))for(const port of event.ports??[])port.close();
  self.close();throw error;
}`;
}
