// Runs only on the harness loopback relay. NIP-42 signatures never publish as EVENT.
export async function relayAuth({page,send,wait,check,origin,account,signer,lines,authFake,mode,act}) {
  const url=origin.replace('http:','ws:')+'/auth-'+mode;
  check('AUTH '+mode+' account is selected',(await act({a:'account.use',pubkey:account})).ok);
  const before=authFake.authEvents.length, retried=authFake.authRetries();
  await page.evaluate(relays=>window.worker.postMessage({t:'test.relays',relays}),[url]);
  await send({t:'open',sub:'auth-'+mode,query:{source:'relay',relay:url,account}});
  if(mode==='extension') {
    await wait(url=>window.messages.some(m=>m.t==='sign'&&JSON.parse(m.event).kind===22242
      &&JSON.parse(m.event).tags.some(t=>t[0]==='relay'&&t[1]===url)),url);
    const request=await page.evaluate(url=>window.messages.find(m=>m.t==='sign'&&JSON.parse(m.event).kind===22242
      &&JSON.parse(m.event).tags.some(t=>t[0]==='relay'&&t[1]===url)),url);
    signer.stdin.write(request.event+'\n');
    const signed=JSON.parse((await lines.next()).value);
    await send({t:'signed',req:request.req,event:JSON.stringify(signed)});
  }
  for(let i=0;i<400&&authFake.authRetries()===retried;i++)await page.waitForTimeout(25);
  const auth=authFake.authEvents.slice(before).find(e=>e.pubkey===account);
  check('AUTH '+mode+' signs the exact connection challenge',auth?.kind===22242&&auth.content===''
    &&auth.tags.some(t=>t[0]==='challenge'&&t[1]==='local smoke challenge')
    &&auth.tags.some(t=>t[0]==='relay'&&t[1]===url));
  check('AUTH '+mode+' reopens a rejected read after acknowledgement',authFake.authRetries()>retried);
  check('AUTH '+mode+' never broadcasts the authentication event',authFake.published.every(e=>e.kind!==22242));
  await send({t:'close',sub:'auth-'+mode});
  await page.evaluate(relays=>window.worker.postMessage({t:'test.relays',relays}),[origin.replace('http:','ws:')]);
  if(mode==='extension') {
    await readmittedRelay({page,send,check,origin,account,signer,lines,authFake});
    await replacedWorker({page,check,origin,account,signer,lines,authFake});
  }
}

async function signEvent(request,signer,lines) {
  signer.stdin.write(request.event+'\n');
  return JSON.parse((await lines.next()).value);
}
async function authRequest(page,url,except=[]) {
  await page.waitForFunction(({url,except})=>window.messages.some(m=>m.t==='sign'&&!except.includes(m.req)
    &&JSON.parse(m.event).kind===22242&&JSON.parse(m.event).tags.some(t=>t[0]==='relay'&&t[1]===url)),{url,except},{timeout:15000});
  return page.evaluate(({url,except})=>window.messages.find(m=>m.t==='sign'&&!except.includes(m.req)
    &&JSON.parse(m.event).kind===22242&&JSON.parse(m.event).tags.some(t=>t[0]==='relay'&&t[1]===url)),{url,except});
}
async function until(page,predicate) {
  const end=Date.now()+15000;
  while(Date.now()<end) { if(await predicate())return; await page.waitForTimeout(25); }
  throw new Error('AUTH lifecycle fixture timed out');
}
async function barrier(page,send,req) {
  await send({t:'stats',req});
  await page.waitForFunction(req=>window.messages.some(m=>m.t==='stats'&&m.req===req),req,{timeout:15000});
}
async function readmittedRelay({page,send,check,origin,account,signer,lines,authFake}) {
  const bootstrap=origin.replace('http:','ws:');
  for(const succeeds of [true,false]) {
    const label=succeeds?'success':'failure',sub='auth-readmit-'+label,url=bootstrap+'/'+sub;
    const routes=relays=>page.evaluate(relays=>window.worker.postMessage({t:'test.relays',relays}),relays);
    const open=()=>send({t:'open',sub,query:{source:'relay',relay:url,account}});
    try {
      await routes([url]);await open();
      const old=await authRequest(page,url);
      await send({t:'close',sub});await routes([bootstrap]);
      await until(page,()=>authFake.connections()===0);
      // Make the signed bytes differ even though this fixture reuses its challenge string.
      await send({t:'test.advance',ms:2000});
      const before=authFake.authEvents.length,retried=authFake.authRetries();
      await routes([url]);await open();
      const current=await authRequest(page,url,[old.req]);
      if(succeeds)await send({t:'signed',req:old.req,event:JSON.stringify(await signEvent(old,signer,lines))});
      else await send({t:'signed',req:old.req,error:'signer-refused'});
      await barrier(page,send,'auth-readmit-barrier-'+label);
      await send({t:'signed',req:current.req,event:JSON.stringify(await signEvent(current,signer,lines))});
      await until(page,()=>authFake.authRetries()>retried);
      const events=authFake.authEvents.slice(before);
      check('AUTH removed relay ignores delayed signer '+label,events.length===1
        &&events[0].created_at===JSON.parse(current.event).created_at
        &&events[0].tags.some(t=>t[0]==='relay'&&t[1]===url));
    } finally {await send({t:'close',sub});await routes([bootstrap]);}
  }
}
async function replacedWorker({page,check,origin,account,signer,lines,authFake}) {
  // A separate browser context owns only this fresh public fixture account.
  const context=await page.context().browser().newContext();
  try {
    await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
    const p=await context.newPage();await p.goto(origin);
    const url=origin.replace('http:','ws:')+'/auth-worker-replacement';
    const send=message=>p.evaluate(m=>window.worker.postMessage(m),message);
    const start=async()=>{
      await p.evaluate(url=>{
        window.messages=[];window.worker=new Worker('/worker.js',{type:'module'});
        window.worker.onmessage=e=>window.messages.push(e.data);
        window.worker.postMessage({t:'test.relays',relays:[url]});
      },url);
      await p.waitForFunction(()=>window.messages.some(m=>m.t==='ready'),null,{timeout:15000});
    };
    const open=()=>send({t:'open',sub:'replacement-auth',query:{source:'relay',relay:url,account}});
    await start();
    await send({t:'act',req:'replacement-account',action:{a:'account.add',how:'extension'}});
    await p.waitForFunction(()=>window.messages.some(m=>m.t==='getPublicKey'&&m.req==='replacement-account'),null,{timeout:15000});
    await send({t:'publicKey',req:'replacement-account',pubkey:account});
    await p.waitForFunction(()=>window.messages.some(m=>m.t==='result'&&m.req==='replacement-account'&&m.ok),null,{timeout:15000});
    await open();const old=await authRequest(p,url);
    await p.evaluate(()=>window.worker.terminate());
    await until(p,()=>authFake.connections()===0);
    const before=authFake.authEvents.length,retried=authFake.authRetries();
    await start();await open();const current=await authRequest(p,url);
    check('AUTH Worker replacement cannot reuse an extension request ID',current.req!==old.req);
    await send({t:'signed',req:old.req,event:JSON.stringify(await signEvent(old,signer,lines))});
    await barrier(p,send,'auth-worker-old-response');
    await p.waitForTimeout(100);
    check('AUTH Worker replacement ignores an old extension signature',authFake.authEvents.length===before);
    await send({t:'signed',req:current.req,event:JSON.stringify(await signEvent(current,signer,lines))});
    await until(p,()=>authFake.authRetries()>retried);
    check('AUTH replacement request survives the old extension reply',authFake.authEvents.length===before+1);
  } finally {await context.close();}
}
