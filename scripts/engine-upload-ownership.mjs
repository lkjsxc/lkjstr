// Real Worker ownership proofs. Every account and browser context is disposable.
export async function uploadOwnership({page,media,check,origin,note,signer,lines}) {
  const context=await page.context().browser().newContext({ignoreHTTPSErrors:true});
  const allowed=new Set([origin,...Object.values(media.origins)]);
  try {
    await context.route('**/*',route=>allowed.has(new URL(route.request().url()).origin)?route.continue():route.abort());
    const p=await context.newPage();await p.goto(origin);
    await twoPorts({page:p,fixture:media.bySigner.local,check,origin});
    await replacement({page:p,fixture:media.bySigner.extension,check,origin,note,signer,lines});
  } finally {await context.close();}
}
async function until(page,predicate) {
  const deadline=Date.now()+15000;
  while(Date.now()<deadline){if(await predicate())return;await page.waitForTimeout(25);}
  throw new Error('upload ownership fixture timed out');
}
async function twoPorts({page,fixture,check,origin}) {
  const req='owned-upload',relay=origin.replace('http:','ws:');
  const send=(port,message)=>page.evaluate(({port,message})=>window.uploadPorts[port].postMessage(message),{port,message});
  const messages=()=>page.evaluate(()=>window.uploadPortMessages);
  const result=async port=>{await until(page,async()=> (await messages())[port].some(m=>m.t==='result'&&m.req===req));return (await messages())[port].find(m=>m.t==='result'&&m.req===req);};
  try {
    await page.evaluate(relay=>{
      window.uploadPortMessages=[[],[]];window.uploadPorts=[];
      window.uploadHost=new Worker('/transport/worker.js',{type:'module'});
      for(let n=0;n<2;n++){
        const pair=new MessageChannel();window.uploadPorts.push(pair.port1);
        pair.port1.onmessage=e=>window.uploadPortMessages[n].push(e.data);pair.port1.start();
        window.uploadHost.postMessage({t:'connect'},[pair.port2]);
        pair.port1.postMessage({t:'relays',relays:[{url:relay,read:true,write:true,search:true}]});
      }
    },relay);
    await until(page,async()=> (await messages()).every(rows=>rows.some(m=>m.t==='ready')));
    await send(0,{t:'act',req:'port-local-create',action:{a:'account.add',how:'create'}});
    await until(page,async()=> (await messages())[0].some(m=>m.t==='result'&&m.req==='port-local-create'&&m.ok));
    const account=(await messages())[0].filter(m=>m.t==='accounts').at(-1).active;
    fixture.set('blossom','hang');const first=fixture.requests.length;
    await page.evaluate(({req,account,server})=>{
      for(const port of window.uploadPorts)port.postMessage({t:'act',req,action:{a:'upload',as:account,server,name:'fixture.png',mime:'image/png',bytes:new Uint8Array([137,80,78,71,13,10,26,10,1,2,3,4]).buffer}});
    },{req,account,server:fixture.origins.blossom});
    const records=()=>fixture.requests.slice(first).filter(r=>r.method==='PUT'&&r.path==='/upload');
    await until(page,()=>records().length===2);
    await send(0,{t:'upload.cancel',req});
    const firstResult=await result(0);
    await until(page,()=>records().filter(r=>r.closed).length===1);
    check('same upload request ID is owned by its port',firstResult.cancelled===true&&!firstResult.ok
      &&!(await messages())[1].some(m=>m.t==='result'&&m.req===req)
      &&records().filter(r=>!r.closed).length===1);
    await send(0,{t:'upload.cancel',req});
    await send(1,{t:'upload.cancel',req});
    const secondResult=await result(1);
    await until(page,()=>records().every(r=>r.closed));
    check('second port can cancel its independent upload',secondResult.cancelled===true&&!secondResult.ok
      &&records().every(r=>!r.complete)
      &&(await messages()).every(rows=>rows.filter(m=>m.t==='result'&&m.req===req).length===1));
  } finally {
    await page.evaluate(()=>{
      for(const port of window.uploadPorts??[]){port.postMessage({t:'detach'});port.close();}
      window.uploadHost?.terminate();delete window.uploadHost;delete window.uploadPorts;delete window.uploadPortMessages;
    }).catch(()=>{});
    fixture.set('blossom','ok');
  }
}
async function replacement({page,fixture,check,origin,note,signer,lines}) {
  const send=message=>page.evaluate(m=>window.worker.postMessage(m),message);
  const messages=()=>page.evaluate(()=>window.messages);
  const req='replacement-upload';
  const start=async()=>{
    await page.evaluate(relay=>{
      window.messages=[];window.worker=new Worker('/worker.js',{type:'module'});
      window.worker.onmessage=e=>window.messages.push(e.data);
      window.worker.postMessage({t:'test.relays',relays:[relay]});
    },origin.replace('http:','ws:'));
    await until(page,async()=> (await messages()).some(m=>m.t==='ready'));
  };
  const begin=()=>page.evaluate(({req,account,server})=>window.worker.postMessage({t:'act',req,action:{a:'upload',as:account,server,name:'fixture.png',mime:'image/png',bytes:new Uint8Array([137,80,78,71,13,10,26,10,1,2,3,4]).buffer}}),{req,account:note.pubkey,server:fixture.origins.blossom});
  const pending=async()=>{
    await until(page,async()=> (await messages()).some(m=>m.t==='sign'&&m.actionReq===req));
    return (await messages()).find(m=>m.t==='sign'&&m.actionReq===req);
  };
  const answer=async request=>{
    if(request.pubkey!==note.pubkey)throw new Error('unexpected replacement fixture signer');
    signer.stdin.write(request.event+'\n');
    const event=JSON.parse((await lines.next()).value);
    await send({t:'signed',req:request.req,event:JSON.stringify(event)});
  };
  try {
    await start();
    await send({t:'act',req:'replacement-extension',action:{a:'account.add',how:'extension'}});
    await until(page,async()=> (await messages()).some(m=>m.t==='getPublicKey'&&m.req==='replacement-extension'));
    await send({t:'publicKey',req:'replacement-extension',pubkey:note.pubkey});
    await until(page,async()=> (await messages()).some(m=>m.t==='result'&&m.req==='replacement-extension'&&m.ok));
    fixture.set('blossom','ok');const first=fixture.requests.length;
    await begin();const old=await pending();
    await page.evaluate(()=>window.worker.terminate());
    await start();await begin();const current=await pending();
    check('upload Worker replacement cannot reuse an extension request ID',current.req!==old.req);
    await answer(old);
    await send({t:'stats',req:'upload-replacement-barrier'});
    await until(page,async()=> (await messages()).some(m=>m.t==='stats'&&m.req==='upload-replacement-barrier'));
    await page.waitForTimeout(100);
    check('old upload authorization cannot start HTTP on a replacement Worker',fixture.requests.length===first);
    await answer(current);
    await until(page,async()=> (await messages()).some(m=>m.t==='result'&&m.req===req));
    const value=(await messages()).find(m=>m.t==='result'&&m.req===req);
    check('replacement upload keeps its own signer response',value.ok&&value.uploaded
      &&fixture.requests.slice(first).filter(r=>r.method==='PUT').length===1);
  } finally {await page.evaluate(()=>window.worker?.terminate()).catch(()=>{});}
}
