// The shipped exports and WASM remain unchanged. Only browser boundaries are owned.
export function cacheBoot() {
  return `const pending=[];self.onmessage=e=>pending.push(e);
const config=new URL(self.location).searchParams,offline=config.get('offline')==='1',Socket=self.WebSocket;
let abortMetadata=config.get('abortMetadata')==='1';const put=IDBObjectStore.prototype.put;
IDBObjectStore.prototype.put=function(value,key){const request=put.apply(this,arguments);
if(abortMetadata&&this.name==='kv'&&key==='verified-public-metadata-v1'){
this.transaction.abort();self.postMessage({fixture:'metadata-aborted'});}return request;};
self.WebSocket=class extends Socket{constructor(url,...rest){const u=new URL(url,self.location);
if(offline||u.host!==self.location.host)throw Error('cache fixture socket blocked');super(url,...rest);}};
const fetchOwned=self.fetch.bind(self);
self.fetch=(input,init)=>{const u=new URL(typeof input==='string'||input instanceof URL?String(input):input.url,self.location);
if(u.origin!==self.location.origin)throw Error('cache fixture HTTP blocked');return fetchOwned(input,init);};
const {default:init,start}=await import('./lkjstr_engine.js');await init();const host=start(),input=self.onmessage;
self.onmessage=e=>{if(e.data?.t==='fixture.stop'){host.stop();self.postMessage({fixture:'stopped'});}
else if(e.data?.t==='fixture.metadata.allow'){abortMetadata=false;self.postMessage({fixture:'metadata-allowed'});}
else input(e);};for(const event of pending)self.onmessage(event);`;
}
