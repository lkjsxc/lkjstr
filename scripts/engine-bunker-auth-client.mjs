// Two independently owned MessagePorts exercise one real shared-engine Host.
export async function authorizationClient(context, origin) {
  const page=await context.newPage();await page.goto(origin);
  await page.evaluate(()=>{
    window.authMessages=[[],[]];window.authControls=[];window.authPorts=[];
    window.authWorker=new Worker('/auth-worker.js',{type:'module'});
    window.authWorker.onmessage=e=>window.authControls.push(e.data);
    window.authWorker.onerror=()=>window.authControls.push({t:'worker-error'});
    for(let n=0;n<2;n++) {
      const pair=new MessageChannel();window.authPorts.push(pair.port1);
      pair.port1.onmessage=e=>{if(window.authMessages[n].length<2048)window.authMessages[n].push(e.data);};
      pair.port1.start();window.authWorker.postMessage({t:'attach'},[pair.port2]);
    }
  });
  const all=client=>page.evaluate(client=>window.authMessages[client],client);
  const send=(client,message)=>page.evaluate(({client,message})=>window.authPorts[client].postMessage(message),{client,message});
  async function until(predicate,client=0,ms=15000) {
    const end=Date.now()+ms;
    while(Date.now()<end) {
      const messages=await all(client);
      if(await page.evaluate(()=>window.authControls.some(m=>m.t==='worker-error')))throw Error('authorization Worker error');
      if(predicate(messages))return messages;
      await page.waitForTimeout(20);
    }
    const messages=await all(client);
    throw Error('authorization wait timed out '+JSON.stringify({client,types:messages.slice(-8).map(m=>m.t),
      auth:messages.filter(m=>m.t==='signer.auth').map(m=>({method:m.method,hasAccount:!!m.account})),
      results:messages.filter(m=>m.t==='result').slice(-3).map(m=>({ok:m.ok,code:m.error?.code}))}));
  }
  await until(ms=>ms.some(m=>m.t==='ready'),0);await until(ms=>ms.some(m=>m.t==='ready'),1);
  let serial=0;
  const begin=async(action,client=0)=>{const req='owned-auth-'+(++serial);await send(client,{t:'act',req,action});return req;};
  const result=async(req,client=0)=>(await until(ms=>ms.some(m=>m.t==='result'&&m.req===req),client))
    .find(m=>m.t==='result'&&m.req===req);
  const act=async(action,client=0)=>result(await begin(action,client),client);
  const latest=ms=>ms.filter(m=>m.t==='signer.auth').at(-1);
  const challenge=async(after=0,client=0)=>latest(await until(ms=>ms.filter(m=>m.t==='signer.auth').length>after,client));
  const control=async(t)=>{
    const before=await page.evaluate(()=>window.authControls.length);
    await page.evaluate(t=>window.authWorker.postMessage({t}),t);
    await page.waitForFunction(n=>window.authControls.length>n,before,{timeout:5000});
    return page.evaluate(()=>window.authControls.at(-1));
  };
  return {page,all,send,until,begin,result,act,latest,challenge,control,
    async close(){await page.evaluate(()=>{for(const p of window.authPorts)p.close();window.authWorker.terminate();});await page.close();}};
}
