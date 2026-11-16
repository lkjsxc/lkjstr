// Test-only browser effects: no product exports, keys, external traffic or clock changes outside this Worker.
export function storageBoot(noIdb = false) {
  return `let clock=0;const nativeNow=performance.now.bind(performance);
Object.defineProperty(performance,'now',{value:()=>nativeNow()+clock});
let estimateMode='ready',countMode='ready',estimates=0,aborts=0,sockets=0;
const reads=[],estimateWaiters=[],countWaiters=[];
self.WebSocket=class{constructor(){sockets++;throw Error('fixture forbids sockets');}};
const fetchOwn=self.fetch.bind(self);self.fetch=(input,init)=>{const u=new URL(typeof input==='string'?input:input.url??input,self.location);if(u.origin!==self.location.origin)return Promise.reject(Error('fixture forbids external HTTP'));return fetchOwn(input,init);};
const estimate=()=>{estimates++;if(estimateMode==='failed')return Promise.reject(Error('fixture estimate rejection'));
if(estimateMode==='hold')return new Promise(resolve=>estimateWaiters.push(resolve));
return Promise.resolve(estimateMode==='invalid'?{usage:1.5,quota:900}:{usage:700,quota:900});};
Object.defineProperty(navigator,'storage',{value:{get estimate(){return estimateMode==='unsupported'?undefined:estimate;}},configurable:true});
const nativeTransaction=IDBDatabase.prototype.transaction;
IDBDatabase.prototype.transaction=function(names,mode,options){const tx=nativeTransaction.call(this,names,mode,options);
if(names==='events'&&(!mode||mode==='readonly')&&countMode==='hold'){
const descriptor=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'oncomplete');let current=null;
Object.defineProperty(tx,'oncomplete',{get:()=>current,set:fn=>{current=fn;descriptor.set.call(tx,fn?event=>{countWaiters.push(()=>current?.(event));}:null);}});
}return tx;};
const nativeAbort=IDBTransaction.prototype.abort;IDBTransaction.prototype.abort=function(){aborts++;return nativeAbort.call(this);};
for(const name of ['get','getAll','openCursor','count']){const native=IDBObjectStore.prototype[name];IDBObjectStore.prototype[name]=function(...args){if(reads.length<128)reads.push({store:this.name,method:name});if(name==='count'&&this.name==='events'&&countMode==='failed')throw Error('fixture count failure');return native.apply(this,args);};}
${noIdb ? "Object.defineProperty(self,'indexedDB',{value:undefined,configurable:true});" : ''}
import init,{start_port_host}from './lkjstr_engine.js';const queued=[];self.onmessage=e=>queued.push(e);await init();const handle=start_port_host(),input=self.onmessage;
self.onmessage=e=>{const m=e.data,reply=value=>self.postMessage({fixtureRequest:m.fixtureRequest,...value});
if(m.t==='fixture.mode'){if(['ready','hold','failed','invalid','unsupported'].includes(m.estimate))estimateMode=m.estimate;if(['ready','hold','failed'].includes(m.count))countMode=m.count;reply({ok:true});}
else if(m.t==='fixture.trace')reply({reads,estimates,aborts,sockets,heldCounts:countWaiters.length,heldEstimates:estimateWaiters.length});
else if(m.t==='fixture.reset'){reads.length=0;reply({ok:true});}
else if(m.t==='fixture.estimate'){for(const resolve of estimateWaiters.splice(0))resolve(m.value??{usage:700,quota:900});reply({ok:true});}
else if(m.t==='fixture.count'){for(const complete of countWaiters.splice(0))complete();reply({ok:true});}
else if(m.t==='fixture.advance'){if(Number.isInteger(m.ms)&&m.ms>=0&&m.ms<=16000)clock+=m.ms;reply({ok:true});}
else if(m.t==='fixture.stop'){handle.stop();for(const resolve of estimateWaiters.splice(0))resolve({usage:700,quota:900});for(const complete of countWaiters.splice(0))complete();reply({ok:true});}
else{input(e);for(const port of e.ports){const receive=port.onmessage;port.onmessage=event=>{receive(event);self.postMessage({observed:{t:event.data?.t,req:event.data?.req}});};}}};for(const e of queued)self.onmessage(e);self.postMessage({started:true});`;
}
