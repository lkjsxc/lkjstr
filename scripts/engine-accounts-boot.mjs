// Test bootstrap only. The production module and WASM are served unchanged.
export function accountsBoot() {
  return `const pending=[];self.onmessage=e=>pending.push(e);
self.WebSocket=class{constructor(){throw Error('account fixture blocks every socket');}};
const ownFetch=self.fetch.bind(self);
self.fetch=(input,init)=>{const u=new URL(typeof input==='string'||input instanceof URL?String(input):input.url,self.location);
if(u.origin!==self.location.origin)throw Error('account fixture blocks external HTTP');return ownFetch(input,init);};
const {default:init,start}=await import('./lkjstr_engine.js');await init();const host=start(),input=self.onmessage;
self.onmessage=e=>{if(e.data?.t==='fixture.stop'){host.stop();self.postMessage({fixture:'stopped'});}else input(e);};
for(const event of pending)self.onmessage(event);`;
}
