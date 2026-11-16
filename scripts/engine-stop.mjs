// Retained real handles, owned accounts and counts-only harness probes. No relay traffic.
import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { loadavg } from 'node:os';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright-core';
const pkg = resolve(process.env.LKJSTR_ENGINE_PKG ?? 'tmp/engine-pkg');
const output = resolve(process.env.LKJSTR_ENGINE_REPORT ?? 'tmp/engine-stop');
await mkdir(output, {recursive:true});
process.env.TMPDIR = process.env.LKJSTR_TEST_TMPDIR ?? join(resolve(process.env.CARGO_TARGET_DIR ?? 'target', '..'), 'tmp');
await mkdir(process.env.TMPDIR, {recursive:true});
const report = {started:new Date().toISOString(), loadStart:loadavg(), package:pkg,
  wasmSha256:createHash('sha256').update(await readFile(join(pkg,'lkjstr_engine_bg.wasm'))).digest('hex'), checks:[], cases:[]};
const check = (name, ok) => {report.checks.push({name,ok:Boolean(ok)});console.log((ok?'ok ':'FAIL ')+name);};
const boot = `const NativeWebSocket=globalThis.WebSocket;
globalThis.WebSocket=class extends NativeWebSocket {constructor(){throw Error('stop fixture has no relay permission')}};
import init,{start,start_shared,start_port_host} from './lkjstr_engine.js';
const params=new URL(self.location).searchParams,shared=params.has('shared'),ports=params.has('ports'),queued=[];
const closedPorts=new WeakSet(),closePort=MessagePort.prototype.close;
MessagePort.prototype.close=function(){closedPorts.add(this);return closePort.call(this);};
if(shared)self.onconnect=e=>queued.push(e);else self.onmessage=e=>queued.push(e);
await init();const handle=shared?start_shared():ports?start_port_host():start();
const input=shared?self.onconnect:self.onmessage;
function control(e){
 if(e.data?.t!=='test.stop')return;
 const reply=e.ports[0],account=e.data.account;
 try{
  handle.prime_private_stop(account);
  const before=handle.private_stop_counts(account);handle.stop();
  const after=handle.private_stop_counts(account);handle.stop();
  const repeated=handle.private_stop_counts(account);
  handle.replay_stopped_input(account);const afterLate=handle.private_stop_counts(account);
  const globalInputCleared=shared?self.onconnect===null:self.onmessage===null;
  let rejectedPortClosed;
  if(ports){const late=new MessageChannel();try{
    input(new MessageEvent('message',{data:{t:'attach'},ports:[late.port2]}));
    rejectedPortClosed=closedPorts.has(late.port2);
  }finally{late.port1.close();late.port2.close();}}
  setTimeout(()=>{try{
    const retained=handle.private_stop_counts(account);
    const replacement=shared?start_shared():ports?start_port_host():start();
    const replacementInput=shared?self.onconnect:self.onmessage;
    handle.stop();handle.free();
    const replacementInputSurvives=(shared?self.onconnect:self.onmessage)===replacementInput;
    replacement.stop();replacement.free();
    const afterFreeGlobalInputCleared=shared?self.onconnect===null:self.onmessage===null;
    reply.postMessage({before,after,repeated,afterLate,retained,globalInputCleared,rejectedPortClosed,afterFreeGlobalInputCleared,replacementInputSurvives});
   }catch(error){reply.postMessage({error:String(error)});}finally{reply.close();}},50);
 }catch(error){reply.postMessage({error:String(error)});reply.close();}
}
function connect(e){for(const port of e.ports)port.addEventListener('message',control);input(e);}
if(shared){self.onconnect=connect;for(const e of queued)connect(e);}
else if(ports){self.onmessage=connect;for(const e of queued)connect(e);}
else{self.addEventListener('message',control);for(const e of queued)input(e);}`;
let browser, server;
try {
  server=createServer(async(req,res)=>{
    const path=new URL(req.url,'http://fixture').pathname;
    if(path==='/')return res.writeHead(200,{'content-type':'text/html'}).end('<!doctype html><title>Worker stop fixture</title>');
    if(path==='/worker.js')return res.writeHead(200,{'content-type':'text/javascript'}).end(boot);
    if(!['/lkjstr_engine.js','/lkjstr_engine_bg.wasm'].includes(path))return res.writeHead(404).end();
    try{res.writeHead(200,{'content-type':path.endsWith('.wasm')?'application/wasm':'text/javascript'}).end(await readFile(join(pkg,path)));}
    catch{res.writeHead(404).end();}
  });
  await new Promise((ok,bad)=>{server.once('error',bad);server.listen(0,'127.0.0.1',ok);});
  const origin='http://127.0.0.1:'+server.address().port;
  const base=process.env.HOME+'/.cache/ms-playwright';
  const binary=process.env.LKJSTR_CHROME??join(base,(await readdir(base)).filter(n=>n.startsWith('chromium-')).sort().pop(),'chrome-linux64/chrome');
  browser=await chromium.launch({executablePath:binary,args:['--no-sandbox']});
  for(const mode of ['dedicated','shared','port-host']){
    const shared=mode==='shared',ports=mode==='port-host';
    const context=await browser.newContext();
    try{
      await context.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
      const page=await context.newPage();await page.goto(origin);
      const start=async name=>{
        await page.evaluate(({shared,ports,name})=>{
          window.stopClients??={};
          const worker=shared?new SharedWorker('/worker.js?shared',{type:'module',name}):new Worker(ports?'/worker.js?ports':'/worker.js',{type:'module'});
          const channel=ports?new MessageChannel():undefined;
          const port=shared?worker.port:channel?.port1??worker,record={worker,port,messages:[]};
          port.onmessage=e=>record.messages.push(e.data);
          worker.onerror=e=>record.messages.push({t:'worker-error',message:e.message});
          if(shared||ports)port.start();window.stopClients[name]=record;
          if(ports)worker.postMessage({t:'attach'},[channel.port2]);
        },{shared,ports,name});
        await page.waitForFunction(name=>window.stopClients[name].messages.some(m=>m.t==='ready'),name,{timeout:15000});
      };
      let serial=0;
      const act=async(name,action)=>{
        const req='stop-action-'+(++serial);
        await page.evaluate(({name,req,action})=>window.stopClients[name].port.postMessage({t:'act',req,action}),{name,req,action});
        await page.waitForFunction(({name,req})=>window.stopClients[name].messages.some(m=>m.t==='result'&&m.req===req),{name,req},{timeout:15000});
        return page.evaluate(({name,req})=>window.stopClients[name].messages.find(m=>m.t==='result'&&m.req===req),{name,req});
      };
      const name=mode+'-'+randomUUID();await start(name);
      const created=await act(name,{a:'account.add',how:'create'});
      if(!created.ok)throw Error(mode+' owned account setup failed');
      const account=await page.evaluate(name=>window.stopClients[name].messages.filter(m=>m.t==='accounts').at(-1).accounts[0].author.pubkey,name);
      const loaded=await act(name,{a:'dm.draft.load',as:account,tab:'stop-fixture'});
      if(!loaded.ok||!loaded.dmDraftRevision)throw Error(mode+' owned archive initialization failed');
      const counts=await page.evaluate(async({name,account})=>{
        const {port1,port2}=new MessageChannel();
        try{return await new Promise((ok,bad)=>{
          const timer=setTimeout(()=>bad(Error('retained stop probe deadline')),5000);
          port1.onmessage=e=>{clearTimeout(timer);ok(e.data);};port1.start();
          window.stopClients[name].port.postMessage({t:'test.stop',account},[port2]);
        });}finally{port1.close();port2.close();}
      },{name,account});
      if(counts.error)throw Error(mode+' '+counts.error);
      report.cases.push({mode,...counts});
      if(ports){
        check(mode+' stop clears its global input handler',counts.globalInputCleared);
        check(mode+' stop closes a rejected transferred port',counts.rejectedPortClosed);
        const lateErrors=await page.evaluate(async name=>{
          const record=window.stopClients[name],channel=new MessageChannel();
          try{record.worker.postMessage({t:'late-attach'},[channel.port2]);
            await new Promise(done=>setTimeout(done,100));
            return record.messages.filter(m=>m.t==='worker-error').length;
          }finally{channel.port1.close();}
        },name);
        report.cases.at(-1).latePortErrors=lateErrors;
        check(mode+' free leaves late transferred input inert',counts.afterFreeGlobalInputCleared&&lateErrors===0);
      }
      check(mode+' fixture primes every retained private category',
        ['decryptedConversations','queuedSends','sendingRumors','draftJobs','archiveKeys','authorizedPrivateAccounts','hostAccounts','queuedAccountActions','startupInputs','privateLists','clientSessions','clientQueries'].every(k=>counts.before[k]===1));
      for(const key of ['decryptedConversations','queuedSends','sendingRumors','draftJobs','archiveKeys','archiveTransactions','signerReads','cryptoRequests','authorizedPrivateAccounts','hostAccounts','queuedAccountActions','startupInputs','privateLists','clientSessions','clientQueries','timer','sockets']){
        check(mode+' stop clears '+key,counts.after[key]===0&&counts.retained[key]===0);
      }
      check(mode+' post-stop input cannot repopulate Host state',JSON.stringify(counts.after)===JSON.stringify(counts.afterLate));
      check(mode+' repeated stop is idempotent',JSON.stringify(counts.after)===JSON.stringify(counts.repeated)&&counts.replacementInputSurvives);
      check(mode+' retained handle remains stopped',counts.after.stopped&&counts.retained.stopped);
      const effects=await page.evaluate(name=>window.stopClients[name].messages.filter(m=>m.req?.startsWith('stop-queued-')).length,name);
      check(mode+' stop emits no queued private action result',effects===0);
      const restart=mode+'-restart-'+randomUUID();await start(restart);
      const restored=await page.evaluate(name=>window.stopClients[name].messages.filter(m=>m.t==='accounts').at(-1)?.accounts[0]?.author.pubkey,restart);
      const archive=await act(restart,{a:'dm.draft.load',as:account,tab:'stop-fixture'});
      check(mode+' stop preserves durable account and archive',restored===account&&archive.ok&&archive.dmDraft===undefined&&archive.dmDraftRevision===loaded.dmDraftRevision);
    }finally{await context.close();}
  }
}catch(error){report.failure=String(error);console.error(report.failure);}
finally{
  await browser?.close();
  if(server?.listening)await new Promise(ok=>server.close(ok));
  report.finished=new Date().toISOString();report.loadEnd=loadavg();
  report.ok=!report.failure&&report.checks.every(c=>c.ok);
  await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  if(!report.ok)process.exitCode=1;
  console.log('Stop evidence: '+join(output,'report.json'));
}
