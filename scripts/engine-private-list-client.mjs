// Own origin, fresh context, explicit account, and bounded wait diagnostics containing no private text.
export async function listClient({browser,origin,fixture,fake,kind}){
  const context=await browser.newContext();
  try{
    await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    const page=await context.newPage();await page.goto(origin);
    await page.evaluate(async events=>{
      const db=await new Promise((ok,bad)=>{const r=indexedDB.open('lkjstr-wasm',1);
        r.onupgradeneeded=()=>{const s=r.result.createObjectStore('events',{keyPath:'id'});
          s.createIndex('created_at','created_at');r.result.createObjectStore('kv');};
        r.onerror=bad;r.onsuccess=()=>ok(r.result);});
      try{await new Promise((ok,bad)=>{const tx=db.transaction('events','readwrite');
        tx.oncomplete=ok;tx.onabort=bad;
        for(const e of events)tx.objectStore('events').put({id:e.id,created_at:e.created_at,raw:JSON.stringify(e)});
      });}finally{db.close();}
    },fixture.first.events);
    await page.evaluate(()=>{
      window.messages=[];window.worker=new Worker('/worker.js',{type:'module'});
      window.worker.onmessage=e=>{if(window.messages.length<4096)window.messages.push(e.data);};
      window.worker.onerror=e=>window.messages.push({t:'worker-error',error:e.message});
    });
    const send=m=>page.evaluate(m=>window.worker.postMessage(m),m);
    const all=()=>page.evaluate(()=>window.messages);
    const handled=new Set(),probe={};let serial=0;
    const until=async(predicate,answer=false,ms=15000)=>{
      const end=Date.now()+ms;
      while(Date.now()<end){
        const messages=await all();
        if(messages.some(m=>m.t==='worker-error'))throw Error('private-list Worker failed');
        for(const m of messages){
          if(m.t==='getPublicKey'&&!handled.has(m.req)){
            handled.add(m.req);await send({t:'publicKey',req:m.req,pubkey:fixture.first.pubkey});
          }
          if(answer&&m.t==='crypt'&&m.context?.kind==='private-list'&&!handled.has(m.req)){
            handled.add(m.req);const reply=await fixture.call({crypto:m});
            await send({t:'crypted',req:m.req,value:reply.value});
          }
        }
        if(predicate(messages))return messages;
        await page.waitForTimeout(20);
      }
      await send({t:'stats',req:'list-timeout-stats'});await page.waitForTimeout(100);
      const messages=await all();
      const physical=await page.evaluate(async()=>{
        const db=await new Promise((ok,bad)=>{const r=indexedDB.open('lkjstr-wasm',1);r.onsuccess=()=>ok(r.result);r.onerror=bad;});
        try{return await new Promise((ok,bad)=>{const r=db.transaction('events').objectStore('events').getAllKeys();r.onsuccess=()=>ok(r.result);r.onerror=bad;});}finally{db.close();}
      });
      throw Error('private-list predicate timeout '+JSON.stringify({
        types:messages.slice(-8).map(m=>m.t),crypt:messages.filter(m=>m.t==='crypt').length,
        probe,physical,filters:fake.activeFilters(),stats:messages.filter(m=>m.t==='stats').at(-1)?.stats,publicRows:messages.filter(m=>m.t==='rows'&&m.sub==='public').at(-1)?.rows.map(r=>r.key).slice(-12),fresh:messages.filter(m=>m.t==='fresh').slice(-6).map(m=>({sub:m.sub,count:m.count})),
        states:messages.filter(m=>m.t==='state').slice(-4).map(m=>({sub:m.sub,private:m.state.privateLists})),
      }));
    };
    const act=async action=>{
      const req='private-list-'+(++serial);await send({t:'act',req,action});
      const messages=await until(ms=>ms.some(m=>m.t==='result'&&m.req===req),false,30000);
      return messages.find(m=>m.t==='result'&&m.req===req);
    };
    await until(ms=>ms.some(m=>m.t==='ready'));
    const relay=new URL('/',origin).href.replace('http:','ws:');
    await send({t:'relays',relays:[{url:relay,read:true,write:true,search:true}]});
    const pubkey=fixture.first.pubkey;
    const action=kind==='local'?{a:'account.importEncrypted',key:fixture.first.key,password:fixture.first.password}
      :kind==='extension'?{a:'account.add',how:'extension',key:pubkey}
      :{a:'account.add',how:'key',key:'bunker://'+pubkey+'?relay='+encodeURIComponent(new URL('/bunker',relay).href)};
    const added=await act(action);if(!added.ok)throw Error('private-list account fixture: '+added.error?.code);
    const hint=visible=>send({t:'hint',hint:{visibleSubs:visible,pageHidden:false,idle:false,saveData:false}});
    const open=(sub,source='mutes',visible=true,opt=true)=>send({t:'open',sub,visible,query:{
      source,account:pubkey,privateLists:opt,...(source==='list'?{tag:'30000:'+pubkey+':fixture'}:{})
    }});
    const rows=(ms,sub)=>{
      let rows=[];
      for(const m of ms.filter(m=>m.sub===sub)){
        if(m.t==='rows')rows=[...m.rows];
        if(m.t!=='patch')continue;
        for(const op of m.ops){
          if(op.op==='remove')rows=rows.filter(r=>r.key!==op.key);
          else if(op.op==='update')rows=rows.map(r=>r.key===op.row.key?op.row:r);
          else if(op.op==='insert'){
            const incoming=new Set(op.rows.map(r=>r.key));rows=rows.filter(r=>!incoming.has(r.key));
            const at=op.before===null?-1:rows.findIndex(r=>r.key===op.before);
            rows.splice(at<0?rows.length:at,0,...op.rows);
          }
        }
      }
      return rows;
    };
    const status=(ms,sub)=>ms.filter(m=>m.t==='state'&&m.sub===sub).at(-1)?.state.privateLists;
    const account=ms=>ms.filter(m=>m.t==='accounts').at(-1)?.accounts.find(a=>a.author.pubkey===pubkey);
    const crypts=ms=>ms.filter(m=>m.t==='crypt'&&m.context?.kind==='private-list');
    const barrier=async()=>{const n=(await all()).filter(m=>m.t==='heartbeat').length;
      await send({t:'heartbeat'});await until(ms=>ms.filter(m=>m.t==='heartbeat').length>n);};
    return {page,send,all,until,act,hint,open,rows,status,account,crypts,barrier,handled,probe,pubkey,relay,
      close:()=>context.close()};
  }catch(error){await context.close();throw error;}
}
