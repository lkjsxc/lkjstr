// Fresh context only. Synthetic invalid event-store rows prove stored count != hydrated count.
export async function storageClient(context, origin, noIdb = false) {
  const page=await context.newPage();await page.goto(origin);
  if(!noIdb)await page.evaluate(()=>new Promise((resolve,reject)=>{
    const open=indexedDB.open('lkjstr-wasm',1);
    open.onupgradeneeded=()=>{const db=open.result;db.createObjectStore('kv');db.createObjectStore('events',{keyPath:'id'}).createIndex('created_at','created_at');};
    open.onerror=()=>reject(Error('fixture database failed'));
    open.onsuccess=()=>{const db=open.result,tx=db.transaction(['events','kv'],'readwrite');
      for(let i=0;i<3;i++)tx.objectStore('events').put({id:'synthetic-public-cache-'+i,created_at:i,raw:'invalid fixture public event'});
      tx.objectStore('kv').put('fixture-only-private-sentinel','not-an-account');
      tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>{db.close();reject(Error('fixture seed aborted'));};};
  }));
  await page.evaluate(noIdb=>{
    window.storageMessages=[[],[]];window.storageControls=[];window.storagePorts=[];
    window.storageWorker=new Worker('/storage-worker.js'+(noIdb?'?noidb=1':''),{type:'module'});
    window.storageWorker.onmessage=e=>window.storageControls.push(e.data);
    window.storageWorker.onerror=()=>window.storageControls.push({error:true});
    for(let n=0;n<2;n++){const pair=new MessageChannel();window.storagePorts.push(pair.port1);
      pair.port1.onmessage=e=>{if(window.storageMessages[n].length<256)window.storageMessages[n].push(e.data);};pair.port1.start();window.storageWorker.postMessage({t:'attach'},[pair.port2]);}
  },noIdb);
  const all=client=>page.evaluate(client=>window.storageMessages[client],client);
  const send=(client,message)=>page.evaluate(({client,message})=>window.storagePorts[client].postMessage(message),{client,message});
  async function until(predicate,client=0,ms=5000){const end=Date.now()+ms;
    while(Date.now()<end){if(await page.evaluate(()=>window.storageControls.some(m=>m.error)))throw Error('storage Worker error');const messages=await all(client);if(predicate(messages))return messages;await page.waitForTimeout(15);}
    throw Error('storage wait timed out '+JSON.stringify((await all(client)).slice(-5).map(m=>({t:m.t,req:m.req,phase:m.report?.origin?.phase,code:m.error?.code}))));}
  await page.waitForFunction(()=>window.storageControls.some(m=>m.started),undefined,{timeout:10000});
  if(!noIdb){await until(ms=>ms.some(m=>m.t==='ready'),0);await until(ms=>ms.some(m=>m.t==='ready'),1);}
  let serial=0;
  async function control(t,fields={}){const fixtureRequest=++serial;await page.evaluate(m=>window.storageWorker.postMessage(m),{t,...fields,fixtureRequest});
    await page.waitForFunction(id=>window.storageControls.some(m=>m.fixtureRequest===id),fixtureRequest,{timeout:5000});
    return page.evaluate(id=>window.storageControls.find(m=>m.fixtureRequest===id),fixtureRequest);}
  async function traceUntil(predicate){const end=Date.now()+5000;while(Date.now()<end){const trace=await control('fixture.trace');if(predicate(trace))return trace;await page.waitForTimeout(15);}throw Error('storage effect observation timed out');}
  async function result(req,client=0,after=0){return(await until(ms=>ms.slice(after).some(m=>m.t==='storage'&&m.req===req),client)).slice(after).find(m=>m.t==='storage'&&m.req===req).report;}
  return {page,all,send,until,control,traceUntil,result,
    async close(){await page.evaluate(()=>{for(const port of window.storagePorts)port.close();window.storageWorker.terminate();});await page.close();}};
}
