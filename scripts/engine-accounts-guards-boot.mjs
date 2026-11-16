// Test-only native-IDB observations around unchanged production entry points.
export function accountsGuardsBoot() {
  return String.raw`const pending=[];self.onmessage=e=>pending.push(e);
const fault=new URL(self.location).searchParams.get('fault'),broker=new URL(self.location).searchParams.has('broker');
const audit={opens:0,blocked:0,upgrades:0,successes:0,openErrors:0,closed:0,held:0,readErrors:0,prebootInputs:0,injected:0,sockets:0,http:0,overflow:false,transactions:[]};
const held=[],known=new WeakSet(),closed=new WeakSet(),transactions=new WeakMap();let nextTx=0;
function track(tx){if(transactions.has(tx))return transactions.get(tx);
 const row={id:++nextTx,account:false,revision:false,archive:false,generation:false,complete:false,aborted:false};
 transactions.set(tx,row);if(audit.transactions.length<96)audit.transactions.push(row);else audit.overflow=true;
 tx.addEventListener('complete',()=>row.complete=true,{once:true});tx.addEventListener('abort',()=>row.aborted=true,{once:true});return row;}
const originalOpen=IDBFactory.prototype.open;
IDBFactory.prototype.open=function(...args){const request=originalOpen.apply(this,args);if(args[0]!=='lkjstr-wasm')return request;
 audit.opens++;request.addEventListener('blocked',()=>audit.blocked++);
 request.addEventListener('upgradeneeded',()=>{audit.upgrades++;track(request.transaction);});
 request.addEventListener('error',()=>audit.openErrors++,{once:true});
 request.addEventListener('success',()=>{audit.successes++;known.add(request.result);},{once:true});
 if(fault==='hold-success'){
  const descriptor=Object.getOwnPropertyDescriptor(IDBRequest.prototype,'onsuccess');let installed;
  Object.defineProperty(request,'onsuccess',{configurable:true,get:()=>installed,set:fn=>{installed=fn;
   descriptor.set.call(request,fn?event=>{audit.held++;held.push(()=>fn.call(request,event));}:null);}});
 }
 return request;};
const originalClose=IDBDatabase.prototype.close;
IDBDatabase.prototype.close=function(){if(known.has(this)&&!closed.has(this)){closed.add(this);audit.closed++;}return originalClose.call(this);};
const originalGet=IDBObjectStore.prototype.get;
IDBObjectStore.prototype.get=function(key){const result=originalGet.call(this,key);
 if(this.transaction.db.name==='lkjstr-wasm'&&this.name==='kv'){
  track(this.transaction);
  if(fault==='read-error'&&key==='engine-accounts'&&this.transaction.mode==='readonly'&&!audit.injected){
   result.addEventListener('error',()=>audit.readErrors++,{once:true});audit.injected++;this.transaction.abort();
  }
 }
 return result;};
for(const method of ['put','delete']){const original=IDBObjectStore.prototype[method];
 IDBObjectStore.prototype[method]=function(...args){let row,key;
  if(this.transaction.db.name==='lkjstr-wasm'&&this.name==='kv'){
   row=track(this.transaction);key=method==='put'?args[1]:args[0];
   if(key==='engine-accounts')row.account=true;if(key==='engine-accounts-cas-v2')row.revision=true;
   if(typeof key==='string'&&key.startsWith('dm-drafts-v1:'))row.archive=true;
   if(key==='dm-drafts-generation-v1')row.generation=true;
  }
  const request=original.apply(this,args);
  if(fault==='abort-removal'&&method==='delete'&&row?.archive&&!audit.injected){
   const tx=this.transaction;request.addEventListener('success',()=>{audit.injected++;tx.abort();},{once:true});
  }
  return request;
 };}
self.WebSocket=class{constructor(){audit.sockets++;throw Error('guard fixture blocks sockets');}};
const originalFetch=self.fetch.bind(self);self.fetch=(input,init)=>{
 const url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url,self.location);
 if(url.origin!==self.location.origin){audit.http++;throw Error('guard fixture blocks external HTTP');}return originalFetch(input,init);};
const {default:init,start,start_port_host}=await import('./lkjstr_engine.js');await init();
const host=broker?start_port_host():start(),input=self.onmessage;let stopped=false;
function receive(event){const message=event.data;
 if(message?.fixture==='audit'){self.postMessage({fixture:'audit',req:message.req,audit});return;}
 if(message?.fixture==='release'){for(const run of held.splice(0))run();self.postMessage({fixture:'released'});return;}
 if(message?.fixture==='stop'){stopped=true;host.stop();self.onmessage=receive;self.postMessage({fixture:'stopped'});return;}
 if(!stopped)input(event);
}
self.onmessage=receive;
if(!broker&&new URL(self.location).searchParams.has('prequeue')){
 for(const message of [{t:'act',req:'guard-preboot-action',action:{a:'account.add',how:'create'}},{t:'open',sub:'guard-preboot-view',query:{source:'global'}}]){
  input(new MessageEvent('message',{data:message}));audit.prebootInputs++;
 }
}
self.postMessage({fixture:'started'});for(const event of pending)receive(event);`;
}
