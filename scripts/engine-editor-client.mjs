// A real port-host Worker with disposable local accounts; sockets are blocked before WASM starts.
export const editorBoot = `
import init,{start_port_host} from './lkjstr_engine.js';
const realNow=Date.now.bind(Date);let offset=0;Date.now=()=>realNow()+offset;
const Socket=globalThis.WebSocket;
globalThis.WebSocket=class extends Socket{constructor(){throw new Error('private editor fixture blocks every socket');}};
const queued=[];self.onmessage=e=>queued.push(e);await init();
self.engineHandle=start_port_host();const input=self.onmessage;
self.onmessage=e=>{if(e.data.t==='test.clock'){offset+=e.data.ms;self.postMessage({t:'clock'});}else input(e);};
for(const e of queued)self.onmessage(e);
`;
export async function editorClient(page) {
  await page.evaluate(() => {
    window.editorMessages=[];window.editorPorts=[];window.editorControl=[];
    window.editorHost=new Worker('/editor-worker.js',{type:'module'});
    window.editorHost.onmessage=e=>window.editorControl.push(e.data);
    window.editorHost.onerror=e=>window.editorControl.push({error:e.message});
  });
  const messages = () => page.evaluate(() => window.editorMessages);
  const send = (port,message) => page.evaluate(({port,message}) =>
    window.editorPorts[port].postMessage(message),{port,message});
  async function until(predicate, timeout=20000) {
    const end=Date.now()+timeout;
    while(Date.now()<end) {const all=await messages();if(predicate(all))return all;await page.waitForTimeout(20);}
    throw new Error('private editor fixture deadline');
  }
  async function attach() {
    const port=await page.evaluate(() => {
      const port=window.editorPorts.length,pair=new MessageChannel();
      window.editorMessages.push([]);window.editorPorts.push(pair.port1);
      pair.port1.onmessage=e=>window.editorMessages[port].push(e.data);pair.port1.start();
      window.editorHost.postMessage({t:'connect'},[pair.port2]);return port;
    });
    await until(all=>all[port].some(m=>m.t==='ready'));
    return port;
  }
  let serial=0;
  const begin=async(port,action) => {
    const req='editor-action-'+(++serial);await send(port,{t:'act',req,action});return req;
  };
  const finish=async(port,req) => {
    const all=await until(all=>all[port].some(m=>m.t==='result'&&m.req===req));
    return all[port].find(m=>m.t==='result'&&m.req===req);
  };
  const act=async(port,action) => finish(port,await begin(port,action));
  async function fence(port) {
    const n=(await messages())[port].filter(m=>m.t==='heartbeat').length;
    await send(port,{t:'heartbeat'});
    await until(all=>all[port].filter(m=>m.t==='heartbeat').length>n);
  }
  async function prepare(port,after=0) {
    const all=await until(all=>all[port].slice(after).some(m=>m.t==='dm.flush'&&m.phase==='prepare'));
    return all[port].slice(after).find(m=>m.t==='dm.flush'&&m.phase==='prepare');
  }
  async function close() {
    await page.evaluate(() => {
      for(const p of window.editorPorts??[]) {p.postMessage({t:'detach'});p.close();}
      window.editorHost?.terminate();
      delete window.editorHost;delete window.editorMessages;delete window.editorPorts;
    }).catch(()=>{});
  }
  return {messages,send,until,attach,begin,finish,act,fence,prepare,close};
}
