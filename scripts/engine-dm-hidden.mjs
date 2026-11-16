// Cached private demand through actual Web Locks leader replacement; no public writes.
import { createHash } from 'node:crypto';
export async function hiddenDirectMessages({page,origin,note,signer,lines,fake,check}) {
  // Reuse only the fresh encrypted fixture emitted by directMessages earlier in this suite.
  const wrap=fake.published.find(e=>e.kind===1059&&e.tags.some(t=>t[0]==='p'&&t[1]===note.pubkey));
  if(!wrap)throw new Error('hidden DM fixture needs the preceding DM conformance');
  const crypt=async(peer,data)=>{
    signer.stdin.write(JSON.stringify({fixtureCrypto:{pubkey:note.pubkey,operation:'nip44.decrypt',peer,data}})+'\n');
    return JSON.parse((await lines.next()).value).value;
  };
  const seal=JSON.parse(await crypt(wrap.pubkey,wrap.content));
  const rumor=JSON.parse(await crypt(seal.pubkey,seal.content));
  const peers=[...new Set([rumor.pubkey,...rumor.tags.filter(t=>t[0]==='p').map(t=>t[1])])].sort();
  const conversation=createHash('sha256').update(peers.join(':')).digest('hex');
  const query={account:note.pubkey,conversation,before:rumor.id,limit:10};
  for(const pageHidden of [false,true]) {
    const context=await page.context().browser().newContext();
    try {
      await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
      const leader=await context.newPage();await leader.goto(origin);
      await seed(leader,note.pubkey,wrap);
      await attach(leader,origin);
      const follower=await context.newPage();await follower.goto(origin);await attach(follower,origin);
      await follower.evaluate(({query,pageHidden})=>{
        window.transport.post({t:'hint',hint:{visibleSubs:[],pageHidden,idle:false,saveData:false}});
        window.transport.post({t:'dm.open',sub:'hidden-retained',query,visible:pageHidden});
        window.transport.post({t:'dm.open',sub:'hidden-closed',query,visible:false});
        window.transport.post({t:'dm.close',sub:'hidden-closed'});
      },{query,pageHidden});
      await loaded(follower,'hidden-first-cache');
      check('DM '+(pageHidden?'page':'view')+' starts hidden without crypto',
        await follower.evaluate(()=>!window.hiddenMessages.some(m=>m.t==='crypt')));
      const ready=await follower.evaluate(()=>window.hiddenMessages.filter(m=>m.t==='ready').length);
      await leader.close();
      await follower.waitForFunction(n=>window.hiddenMessages.filter(m=>m.t==='ready').length>n,ready,{timeout:15000});
      await loaded(follower,'hidden-replayed-cache');
      check('DM '+(pageHidden?'page':'view')+' stays private during leader replacement',
        await follower.evaluate(()=>!window.hiddenMessages.some(m=>m.t==='crypt'||m.sub==='hidden-closed')));
      await follower.evaluate(()=>{
        window.transport.post({t:'hint',hint:{visibleSubs:[],pageHidden:false,idle:false,saveData:false}});
        window.transport.post({t:'dm.visible',sub:'hidden-retained',visible:true});
      });
      const handled=new Set();
      await until(follower,async()=>{
        const rows=await follower.evaluate(()=>window.hiddenMessages);
        for(const request of rows.filter(m=>m.t==='crypt'&&!handled.has(m.req))){
          if(request.pubkey!==note.pubkey)throw new Error('unexpected hidden DM fixture account');
          handled.add(request.req);
          signer.stdin.write(JSON.stringify({fixtureCrypto:request})+'\n');
          const reply=JSON.parse((await lines.next()).value);
          await follower.evaluate(({req,value})=>window.transport.post({t:'crypted',req,value}),{req:request.req,value:reply.value});
        }
        return rows.some(m=>m.t==='dm'&&m.sub==='hidden-retained'
          &&m.snapshot.conversations.some(c=>c.key===conversation&&c.last.id===rumor.id));
      });
      check('DM replay retains its conversation and before anchor after showing',handled.size>=2
        &&await follower.evaluate(({conversation,id})=>{
          const value=window.hiddenMessages.filter(m=>m.t==='dm'&&m.sub==='hidden-retained').at(-1)?.snapshot;
          return value?.conversations.some(c=>c.key===conversation&&c.last.id===id)&&value.messages.length===0;
        },{conversation,id:rumor.id}));
      await follower.evaluate(account=>{
        window.transport.post({t:'open',sub:'hidden-public-audit',query:{source:'global',account}});
        window.transport.post({t:'window',sub:'hidden-public-audit',anchor:'top',before:0,after:20});
      },note.pubkey);
      await follower.waitForFunction(()=>window.hiddenMessages.some(m=>m.t==='rows'&&m.sub==='hidden-public-audit'),null,{timeout:15000});
      check('DM replay never exposes plaintext in public rows or persistent event cache',
        await follower.evaluate(async text=>{
          const publicRows=window.hiddenMessages.filter(m=>m.sub==='hidden-public-audit'&&(m.t==='rows'||m.t==='patch'));
          const db=await new Promise((ok,bad)=>{const r=indexedDB.open('lkjstr-wasm');r.onsuccess=()=>ok(r.result);r.onerror=bad;});
          try {
            const records=await new Promise((ok,bad)=>{const r=db.transaction('events').objectStore('events').getAll();r.onsuccess=()=>ok(r.result);r.onerror=bad;});
            return !JSON.stringify(publicRows).includes(text)&&records.every(row=>!row.raw.includes(text));
          } finally {db.close();}
        },rumor.content));
    } finally {await context.close();}
  }
}
async function until(page,predicate) {
  const deadline=Date.now()+15000;
  while(Date.now()<deadline){if(await predicate())return;await page.waitForTimeout(25);}
  throw new Error('hidden DM fixture timed out');
}
async function seed(page,account,event) {
  await page.evaluate(async({account,event})=>{
    const db=await new Promise((ok,bad)=>{
      const r=indexedDB.open('lkjstr-wasm',1);
      r.onupgradeneeded=()=>{const s=r.result.createObjectStore('events',{keyPath:'id'});s.createIndex('created_at','created_at');r.result.createObjectStore('kv');};
      r.onsuccess=()=>ok(r.result);r.onerror=bad;
    });
    try {
      await new Promise((ok,bad)=>{
        const tx=db.transaction(['events','kv'],'readwrite');tx.oncomplete=ok;tx.onabort=bad;
        tx.objectStore('events').put({id:event.id,created_at:event.created_at,raw:JSON.stringify(event)});
        tx.objectStore('kv').put(JSON.stringify({entries:[{pubkey:account,signer:'extension',secret:null}],active:account,seen:{}}),'engine-accounts');
      });
    } finally {db.close();}
  },{account,event});
}
async function attach(page,origin) {
  await page.evaluate(async relay=>{
    const {workerTransport}=await import('/transport/transport.js');
    window.hiddenMessages=[];window.transport=workerTransport({dedicated:true,relays:[{url:relay,read:true,write:true,search:true}]});
    window.transport.listen(m=>window.hiddenMessages.push(m));
  },origin.replace('http:','ws:'));
  await page.waitForFunction(()=>window.hiddenMessages.some(m=>m.t==='ready'),null,{timeout:15000});
}
async function loaded(page,req) {
  await until(page,async()=>{
    await page.evaluate(req=>window.transport.post({t:'stats',req}),req);
    await page.waitForFunction(req=>window.hiddenMessages.some(m=>m.t==='stats'&&m.req===req),req,{timeout:15000});
    return page.evaluate(req=>window.hiddenMessages.filter(m=>m.t==='stats'&&m.req===req).at(-1)?.stats.totals.eventsStored>0,req);
  });
  // Let cached verification and the bounded mark-load/decrypt pump run several turns.
  await page.waitForTimeout(350);
}
