// A non-gating measurement; fresh database with 100000 physical, signed compact rows.
export async function coldStart({context,origin,check}) {
  const page=await context.newPage();
  await page.goto(origin);
  const result=await page.evaluate(async()=>{
    const rows=await (await fetch('/cold-fixtures.json')).json();
    const db=await new Promise((ok,bad)=>{const r=indexedDB.open('lkjstr-wasm',1);r.onupgradeneeded=()=>{const s=r.result.createObjectStore('events',{keyPath:'id'});s.createIndex('created_at','created_at');r.result.createObjectStore('kv');};r.onsuccess=()=>ok(r.result);r.onerror=bad;});
    const seed=performance.now();
    for(let offset=0;offset<rows.length;offset+=1000) {
      await new Promise((ok,bad)=>{const tx=db.transaction('events','readwrite');tx.oncomplete=ok;tx.onabort=bad;const s=tx.objectStore('events');for(const row of rows.slice(offset,offset+1000))s.put(row);});
    }
    const seedMs=performance.now()-seed;
    const count=await new Promise((ok,bad)=>{const r=db.transaction('events').objectStore('events').count();r.onsuccess=()=>ok(r.result);r.onerror=bad;});
    db.close();
    const begin=performance.now();let readyMs,firstRowsMs;
    const messages=[];const worker=new Worker('/worker.js',{type:'module'});
    await new Promise((ok,bad)=>{
      const timer=setTimeout(()=>bad(new Error('cold start timed out')),45000);
      worker.onerror=bad;
      worker.onmessage=({data:m})=>{
        messages.push(m);
        if(m.t==='ready') {readyMs=performance.now()-begin;worker.postMessage({t:'open',sub:'cold',query:{source:'global'}});}
        if(firstRowsMs===undefined&&((m.t==='rows'&&m.rows.length)||(m.t==='patch'&&m.ops.length)))firstRowsMs=performance.now()-begin;
        if(m.t==='rows'&&m.sub==='cold-diag') {
          const facts=Object.fromEntries(m.rows.map(r=>[r.label,JSON.parse(r.value)]));
          if(facts.verified>=2000){clearTimeout(timer);ok();}
        }
      };
      const poll=setInterval(()=>worker.postMessage({t:'open',sub:'cold-diag',query:{source:'diagnostics'}}),100);
      setTimeout(()=>clearInterval(poll),45000);
    });
    const verifiedMs=performance.now()-begin;
    worker.terminate();
    return {physicalRows:count,loadedRows:2000,seedMs,readyMs,firstRowsMs,verifiedMs};
  });
  await page.close();
  check('cold-start fixture contains 100000 physical rows',result.physicalRows===100000);
  return result;
}
