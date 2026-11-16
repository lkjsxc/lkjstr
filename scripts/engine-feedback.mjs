// Owner feedback conformance. Every socket is loopback; HTTP is intercepted.
export async function ownerRelays({page,send,wait,check,note,signer,lines,fake,origin}) {
  const relay=origin.replace('http:','ws:');
  const sign=async(kind,tags,created_at,content='')=>{
    signer.stdin.write(`${JSON.stringify({pubkey:note.pubkey,kind,tags,created_at,content})}\n`);
    return JSON.parse((await lines.next()).value);
  };
  await send({t:'relays',relays:[{url:relay,read:true,write:true,search:true}]});
  await send({t:'open',sub:'owner-relays',query:{source:'relays',account:note.pubkey}});
  const adopted=async(url,read,write)=>{
    url=new URL(url).href;
    await wait(({url,read,write})=>window.messages.some(m=>m.sub==='owner-relays'&&
      (m.rows??m.ops?.flatMap(o=>o.row?[o.row]:o.rows??[])??[]).some(r=>r.url===url&&r.read===read&&r.write===write)),{url,read,write});
  };
  const legacy=`${relay}/legacy`;
  fake.add(await sign(3,[],1700000100,JSON.stringify({[legacy]:{read:true,write:false}})));
  await adopted(legacy,true,false);
  check('sign-in discovers legacy kind 3 relays without an account feed',true);
  const first=`${relay}/owner-first`, next=`${relay}/owner-next`;
  fake.add(await sign(10002,[['r',first,'write']],1700000200));
  await adopted(first,false,true);
  check('bootstrap discovers and adopts owner kind 10002 flags',true);
  await send({t:'window',sub:'owner-relays',anchor:'top',before:0,after:800});
  await wait(url=>window.messages.filter(m=>m.t==='rows'&&m.sub==='owner-relays').at(-1)?.rows[0]?.url===url,new URL(first).href);
  check('NIP-65 owner relays are first with yours and exact usage flags',await page.evaluate(url=>{
    const rows=window.messages.filter(m=>m.t==='rows'&&m.sub==='owner-relays').at(-1).rows;
    return rows[0].url===url&&rows[0].why==='yours'&&!rows[0].read&&rows[0].write&&rows.filter(r=>r.why==='yours').length===1;
  },new URL(first).href));
  await wait(()=>window.messages.filter(m=>m.t==='status').at(-1)?.wanted>=2);
  check('status wanted includes the discovered owner route and bootstrap',true);
  fake.add(await sign(10002,[['r',next,'read'],['r',relay,'write']],1700000300));
  await adopted(next,true,false);
  check('discovery follows newer kind 10002 on retained bootstrap',true);
  await adopted(first,false,false);
  check('newer owner lists replace old relay usage',true);
  // Leave a both-mode fixture for the rest of the action inventory.
  fake.add(await sign(10002,[['r',relay]],1700000400));
  await adopted(relay,true,true);
  await send({t:'close',sub:'owner-relays'});
}

export async function continuity({page,send,wait,check,note,signer,lines,origin,history}) {
  signer.stdin.write(`${JSON.stringify({fixtureRows:5000})}\n`);
  history.push(...JSON.parse((await lines.next()).value));
  const relay=`${origin.replace('http:','ws:')}/continuity`;
  await send({t:'configure',config:{language:'en',heuristics:false,prefetch:false}});
  await send({t:'relays',relays:[{url:relay,read:true,write:true,search:true}]});
  await page.evaluate(()=>{
    window.continuityRows=[];
    const original=window.worker.onmessage;
    window.worker.onmessage=e=>{
      original(e);
      const m=e.data;if(m.sub!=='continuity')return;
      if(m.t==='rows')window.continuityRows=m.rows.slice();
      if(m.t==='patch')for(const op of m.ops){
        const rows=window.continuityRows;
        if(op.op==='remove'){const i=rows.findIndex(r=>r.key===op.key);if(i>=0)rows.splice(i,1);}
        if(op.op==='update'){const i=rows.findIndex(r=>r.key===op.row.key);if(i>=0)rows[i]=op.row;}
        if(op.op==='insert'){const i=op.before===null?rows.length:rows.findIndex(r=>r.key===op.before);rows.splice(i<0?rows.length:i,0,...op.rows);}
      }
    };
  });
  await send({t:'open',sub:'continuity',query:{source:'relay',relay,account:note.pubkey,since:1700100000000,until:1700101249000}});
  await send({t:'hint',hint:{visibleSubs:['continuity'],pageHidden:false,idle:false,saveData:false}});
  let prior=[];
  for(let n=0;n<30;n++){
    await send({t:'window',sub:'continuity',anchor:prior.length?{key:prior.at(-1)}:'top',before:0,after:200,retainAbove:true});
    const target=Math.min(5000,prior.length?prior.length+190:200);
    await page.evaluate(info=>{window.continuityProgress=info;},{page:n+1,prior:prior.length,target});
    await wait(n=>window.continuityRows.length>=n,target);
    const rows=await page.evaluate(()=>window.continuityRows.map(r=>({key:r.key,at:r.at})));
    const keys=rows.map(r=>r.key);
    check(`continuity page ${n+1} retains everything above`,prior.every((id,i)=>keys[i]===id));
    check(`continuity page ${n+1} is unique and stable`,new Set(keys).size===keys.length&&rows.every((r,i)=>!i||rows[i-1].at>r.at||(rows[i-1].at===r.at&&rows[i-1].key>r.key)));
    prior=keys;
    // Keep diagnostics bounded while the retained list grows.
    await page.evaluate(()=>{window.messages=window.messages.filter(m=>m.sub!=='continuity');});
    if(keys.length===5000)break;
  }
  check('5000 relay-paged rows have no gaps or duplicates',prior.length===5000&&history.every(e=>prior.includes(e.id)));
  await send({t:'window',sub:'continuity',anchor:'top',before:0,after:800});
  await wait(()=>window.continuityRows.length===800);
  const first=await page.evaluate(()=>window.continuityRows[0].key);
  const anchor=await page.evaluate(()=>window.continuityRows[499].key);
  await send({t:'window',sub:'continuity',anchor:{key:anchor},before:800,after:200});
  await wait(()=>window.continuityRows.length===699);
  check('protocol 3 retains the first row across 500 read notes with 800-row windows',await page.evaluate(first=>window.continuityRows[0].key===first,first));
  const at=history[2345].created_at*1000;
  await send({t:'rowAtTime',req:'continuity-time',sub:'continuity',at});
  await wait(()=>window.messages.some(m=>m.t==='rowAtTime'&&m.req==='continuity-time'));
  const row=await page.evaluate(()=>window.messages.find(m=>m.t==='rowAtTime'&&m.req==='continuity-time'));
  const expected=history.filter(e=>e.created_at*1000<=at).sort((a,b)=>b.created_at-a.created_at||b.id.localeCompare(a.id))[0];
  check('rowAtTime uses the same timestamp tie order',row.cached&&row.key===expected.id&&row.at===at);
  await send({t:'stats',req:'feedback-stats'});
  await wait(()=>window.messages.some(m=>m.t==='stats'&&m.req==='feedback-stats'));
  const stats=await page.evaluate(()=>window.messages.find(m=>m.t==='stats'&&m.req==='feedback-stats').stats);
  check('stats report real events, duplicate drops, byte counts and subscriptions',stats.totals.eventsStored>=5000&&stats.relays.some(r=>r.eventsReceived>=5000&&r.duplicatesDropped>0&&r.bytesIn>0&&r.bytesOut>0&&r.connectedSince>0));
  await send({t:'close',sub:'continuity'});
}

// Playwright predicates must be synchronous; persistence needs explicit async polling.
export async function waitForStoredEvent(page,id) {
  const deadline=Date.now()+15_000;
  while(Date.now()<deadline){
    const found=await page.evaluate(async id=>{
      const db=await new Promise((ok,bad)=>{const r=indexedDB.open('lkjstr-wasm');r.onsuccess=()=>ok(r.result);r.onerror=bad;});
      try {
        return await new Promise((ok,bad)=>{const r=db.transaction('events').objectStore('events').get(id);r.onsuccess=()=>ok(!!r.result);r.onerror=bad;});
      } finally { db.close(); }
    },id);
    if(found)return;
    await page.waitForTimeout(25);
  }
  throw new Error('event persistence timed out: '+id);
}

export async function localDiscovery({page,send,wait,check,start,origin}) {
  const act=async(req,action)=>{
    await send({t:'act',req,action});
    await wait(req=>window.messages.some(m=>m.t==='result'&&m.req===req),req);
    return page.evaluate(req=>window.messages.find(m=>m.t==='result'&&m.req===req),req);
  };
  check('local discovery fixture creates an account',(await act('local-owner-create',{a:'account.add',how:'create'})).ok);
  const key=await page.evaluate(()=>window.messages.filter(m=>m.t==='accounts').at(-1).active);
  await page.evaluate(key=>window.worker.postMessage({t:'act',req:'default-blossom',action:{a:'upload',as:key,name:'fixture.png',mime:'image/png',bytes:new Uint8Array([1,2,3,4]).buffer}}),key);
  await wait(()=>window.messages.some(m=>m.t==='result'&&m.req==='default-blossom'));
  check('absent kind 10063 uploads through default Blossom',await page.evaluate(()=>window.messages.find(m=>m.t==='result'&&m.req==='default-blossom').uploaded?.url.startsWith('https://blossom.band/')));
  const relay=`${origin.replace('http:','ws:')}/local-owner`;
  const saved=await act('local-owner-save',{a:'relays.save',as:key,relays:[{url:relay,read:true,write:true}]});
  check('local discovery fixture publishes relay list',saved.ok);
  // Await committed public events, then remove only the test event cache. Account
  // secrets remain inside IndexedDB and are never read back into the harness.
  await waitForStoredEvent(page,saved.id);
  await page.evaluate(async()=>{
    window.worker.terminate();
    const db=await new Promise((ok,bad)=>{const r=indexedDB.open('lkjstr-wasm');r.onsuccess=()=>ok(r.result);r.onerror=bad;});
    await new Promise((ok,bad)=>{const tx=db.transaction('events','readwrite');tx.objectStore('events').clear();tx.oncomplete=ok;tx.onerror=bad;});db.close();
  });
  await start();
  await send({t:'relays',relays:[{url:origin.replace('http:','ws:'),read:true,write:true,search:true}]});
  await send({t:'open',sub:'local-relays',query:{source:'relays',account:key}});
  await wait(url=>window.messages.some(m=>m.sub==='local-relays'&&(m.rows??m.ops?.flatMap(o=>o.row?[o.row]:o.rows??[])??[]).some(r=>r.url===url&&r.read&&r.write)),relay);
  check('restored local signer rediscovers relay list with an empty event cache',true);
  await send({t:'close',sub:'local-relays'});
  check('local discovery fixture account removed',(await act('local-owner-remove',{a:'account.remove',pubkey:key})).ok);
}
