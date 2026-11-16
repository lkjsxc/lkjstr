// Deterministic post-ack probes: a microtask runs the query before any timer/status pump.
import { spawn } from 'node:child_process';
const boot=`
import init,{start} from './lkjstr_engine.js';
const Socket=self.WebSocket;
self.WebSocket=class extends Socket{constructor(url,...rest){
  if(new URL(url).hostname!=='127.0.0.1')throw new DOMException('Fixture blocked relay','SecurityError');
  super(url,...rest);
}};
const queued=[];self.onmessage=e=>queued.push(e);let after,failWrite=false,input;
const post=self.postMessage.bind(self);
self.postMessage=(message,...rest)=>{
  post(message,...rest);
  if(message.t==='result'&&after?.req===message.req){
    const query=after.message;after=undefined;
    queueMicrotask(()=>input({data:query}));
  }
};
const put=IDBObjectStore.prototype.put;
IDBObjectStore.prototype.put=function(...args){
  if(failWrite&&this.name==='kv'&&args[1]==='engine-accounts'){
    failWrite=false;this.transaction.abort();
  }
  return put.apply(this,args);
};
await init();self.engineHandle=start();input=self.onmessage;
self.onmessage=e=>{
  if(e.data.t==='test.afterResult')after=e.data;
  else if(e.data.t==='test.failAccountWrite')failWrite=true;
  else if(e.data.t==='test.relays'){
    if(typeof self.engineHandle.set_test_relays==='function')self.engineHandle.set_test_relays(e.data.relays);
    else input({data:{t:'relays',relays:e.data.relays.map(url=>({url,read:true,write:true,search:true}))}});
  }
  else input(e);
};
for(const e of queued)self.onmessage(e);
`;
async function fixtures() {
  return new Promise((resolve,reject)=>{
    const binary=process.env.LKJSTR_PRIVATE_FIXTURE_BIN;
    const child=spawn(binary??'cargo',binary?[]:['run','-q','-p','lkjstr-core','--example','engine-private-fixtures'],{stdio:['ignore','pipe','pipe']});
    let raw='';child.stderr.resume();
    child.stdout.on('data',chunk=>{raw+=chunk;if(raw.length>1048576)child.kill();});
    child.on('error',reject);child.on('close',code=>{
      if(code!==0)return reject(new Error('private fixture helper failed'));
      try{resolve(JSON.parse(raw));}catch{reject(new Error('invalid private fixture output'));}
    });
  });
}
async function until(page,predicate) {
  const deadline=Date.now()+20000;
  while(Date.now()<deadline){if(await predicate())return;await page.waitForTimeout(25);}
  throw new Error('private revocation fixture timed out');
}
export async function privateRevocation({page,origin,check}) {
  const {accounts}=await fixtures();
  const context=await page.context().browser().newContext();
  try {
    await context.route('**/*',route=>{
      if(route.request().url()===origin+'/private-worker.js')return route.fulfill({contentType:'text/javascript',body:boot});
      return new URL(route.request().url()).origin===origin?route.continue():route.abort();
    });
    const p=await context.newPage();await p.goto(origin);
    await p.evaluate(async accounts=>{
      const db=await new Promise((ok,bad)=>{
        const r=indexedDB.open('lkjstr-wasm',1);
        r.onupgradeneeded=()=>{const s=r.result.createObjectStore('events',{keyPath:'id'});s.createIndex('created_at','created_at');r.result.createObjectStore('kv');};
        r.onsuccess=()=>ok(r.result);r.onerror=bad;
      });
      try{await new Promise((ok,bad)=>{
        const tx=db.transaction('events','readwrite');tx.oncomplete=ok;tx.onabort=bad;
        for(const account of accounts)for(const event of account.events)tx.objectStore('events').put({id:event.id,created_at:event.created_at,raw:JSON.stringify(event)});
      });}finally{db.close();}
    },accounts);
    await p.evaluate(relay=>{
      window.privateMessages=[];window.worker=new Worker('/private-worker.js',{type:'module'});
      window.worker.onmessage=e=>window.privateMessages.push(e.data);
      window.worker.postMessage({t:'test.relays',relays:[relay]});
    },origin.replace('http:','ws:'));
    const send=message=>p.evaluate(m=>window.worker.postMessage(m),message);
    const all=()=>p.evaluate(()=>window.privateMessages);
    let serial=0;
    const action=async(action,probe,fail=false)=>{
      const req='private-revoke-'+(++serial),sub='post-ack-'+serial;
      if(probe)await send({t:'test.afterResult',req,message:{t:'open',sub,query:{source:'mutes',account:probe.pubkey}}});
      if(fail)await send({t:'test.failAccountWrite'});
      await send({t:'act',req,action});
      await until(p,async()=> (await all()).some(m=>m.t==='result'&&m.req===req));
      if(probe)await until(p,async()=> (await all()).some(m=>m.t==='rows'&&m.sub===sub));
      const rows=await all(),result=rows.find(m=>m.t==='result'&&m.req===req);
      return {req,sub,result,rows,probe:rows.find(m=>m.t==='rows'&&m.sub===sub)};
    };
    await until(p,async()=> (await all()).some(m=>m.t==='ready'));
    for(const [index,account] of accounts.entries()) {
      check('private fixture imports account '+index,(await action({a:'account.importEncrypted',key:account.key,password:account.password})).result.ok);
      await send({t:'open',sub:'held-'+index,query:{source:'mutes',account:account.pubkey}});
      await until(p,async()=> (await all()).some(m=>m.t==='rows'&&m.sub==='held-'+index&&JSON.stringify(m.rows).includes(account.word)));
      const anchor='mute:word:'+account.word;
      await send({t:'window',sub:'held-'+index,anchor:{key:anchor},before:0,after:20});
      await until(p,async()=> (await all()).some(m=>m.t==='timeline'&&m.sub==='held-'+index&&m.timeline.anchor===anchor));
    }
    const [a,b]=accounts;
    await send({t:'hint',hint:{visibleSubs:['held-1'],pageHidden:false,idle:false,saveData:false}});
    const failed=await action({a:'account.lock',pubkey:a.pubkey},a,true);
    check('failed lock transaction preserves authorized private projection',!failed.result.ok
      &&JSON.stringify(failed.probe.rows).includes(a.word));
    const locked=await action({a:'account.lock',pubkey:a.pubkey},a);
    check('post-lock acknowledgement query cannot see revoked private entries',locked.result.ok
      &&!JSON.stringify(locked.probe.rows).includes(a.word)&&JSON.stringify(locked.probe.rows).includes(a.public));
    const at=locked.rows.findIndex(m=>m.t==='result'&&m.req===locked.req);
    const held=locked.rows.slice(0,at).filter(m=>m.t==='rows'&&m.sub==='held-0').at(-1);
    const other=locked.rows.filter(m=>m.t==='rows'&&m.sub==='held-1').at(-1);
    check('lock purges hidden derived rows before acknowledgement',held&&!JSON.stringify(held.rows).includes(a.word));
    const timeline=locked.rows.slice(0,at).filter(m=>m.t==='timeline'&&m.sub==='held-0').at(-1);
    check('lock removes private-word timeline anchors before acknowledgement',timeline&&!JSON.stringify(timeline).includes(a.word));
    check('lock preserves another account private entries',other&&JSON.stringify(other.rows).includes(b.word));
    check('private fixture unlock commits',(await action({a:'account.unlock',pubkey:a.pubkey,password:a.password})).result.ok);
    await send({t:'open',sub:'unlock-refresh',query:{source:'mutes',account:a.pubkey}});
    await until(p,async()=> (await all()).filter(m=>m.t==='rows'&&m.sub==='unlock-refresh').some(m=>JSON.stringify(m.rows).includes(a.word)));
    const removed=await action({a:'account.remove',pubkey:a.pubkey},a);
    check('post-remove acknowledgement query cannot restore cached private entries',removed.result.ok
      &&!JSON.stringify(removed.probe.rows).includes(a.word)&&JSON.stringify(removed.probe.rows).includes(a.public));
    const failedRemove=await action({a:'account.remove',pubkey:b.pubkey},b,true);
    check('failed removal transaction retains the account private policy',!failedRemove.result.ok
      &&JSON.stringify(failedRemove.probe.rows).includes(b.word));
    const remaining=await action({a:'account.remove',pubkey:b.pubkey},b);
    check('second account removal clears only its private entries',remaining.result.ok
      &&!JSON.stringify(remaining.probe.rows).includes(b.word));
  } finally {await context.close();}
}
