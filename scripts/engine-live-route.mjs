// Finite production-Worker live-route recovery proof. Fresh owned loopback only.
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { loadavg } from 'node:os';
import { resolve, join, basename } from 'node:path';
import { chromium } from 'playwright-core';
import bundle from 'playwright-core/lib/utilsBundle';
import { historyFixture } from './engine-history-route-fixture.mjs';
import { liveRoutes } from './engine-live-route-fixture.mjs';
const pkg=resolve(process.env.LKJSTR_ENGINE_PKG??'tmp/engine-pkg');
const out=resolve(process.env.LKJSTR_ENGINE_REPORT??'tmp/live-route-worker');
await mkdir(out,{recursive:true});
const temporaryBase=process.env.LKJSTR_TEST_TMPDIR??join(resolve(process.env.CARGO_TARGET_DIR??'target','..'),'tmp');
let temporary;
let loader={module:'/lkjstr_engine.js',wasm:'lkjstr_engine_bg.wasm'};
try{loader=JSON.parse(await readFile(join(pkg,'fixture-loader.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
const report={startedAt:new Date().toISOString(),loadStart:loadavg(),package:pkg,
  wasmSha256:createHash('sha256').update(await readFile(join(pkg,loader.wasm))).digest('hex'),requests:[],checks:[],errors:[]};
const check=(name,ok,observed)=>{report.checks.push({name,ok:!!ok,...(observed===undefined?{}:{observed})});console.log((ok?'ok ':'FAIL ')+name);};
const pause=ms=>new Promise(ok=>setTimeout(ok,ms));
async function wait(test,timeout){const end=Date.now()+timeout;while(Date.now()<end){if(await test())return true;await pause(25);}return false;}
const boot=`const queued=[];self.onmessage=e=>queued.push(e);
const NativeSocket=self.WebSocket,allowed=self.location.origin.replace('http:','ws:');
self.WebSocket=class extends NativeSocket{constructor(url,...rest){const u=new URL(url);if(u.origin!==allowed||!['/a','/b','/c'].includes(u.pathname))throw new Error('blocked non-owned socket');super(url,...rest);}send(text){const m=JSON.parse(text);if(!['REQ','CLOSE'].includes(m[0]))throw new Error('blocked publication');super.send(text);}};
const nativeFetch=self.fetch;self.fetch=(input,options)=>{if(new URL(typeof input==='string'||input instanceof URL?String(input):input.url,self.location.href).origin!==self.location.origin)throw new Error('blocked non-owned fetch');return nativeFetch(input,options);};
const {default:init,start}=await import(${JSON.stringify(loader.module)});await init();self.handle=start();const input=self.onmessage;for(const event of queued)input(event);`;
let browser,server,ws,fixture,route,page;
try{
  await mkdir(temporaryBase,{recursive:true});temporary=await mkdtemp(join(temporaryBase,'lv-'));process.env.TMPDIR=temporary;
  fixture=await historyFixture();route=liveRoutes(fixture.events,report.requests);
  report.helperSha256=createHash('sha256').update(await readFile(fixture.bin)).digest('hex');
  report.fixture={old:route.old,later:route.later};
  server=createServer(async(req,res)=>{
    const path=new URL(req.url,'http://fixture').pathname;
    if(path==='/')return res.writeHead(200,{'content-type':'text/html'}).end('<!doctype html><title>Owned live recovery fixture</title>');
    if(path==='/worker.js')return res.writeHead(200,{'content-type':'text/javascript'}).end(boot);
    if(['/a','/b','/c'].includes(path))return res.writeHead(200,{'content-type':'application/nostr+json'}).end(JSON.stringify({limitation:{max_limit:200}}));
    if(![loader.module,'/'+loader.wasm].includes(path))return res.writeHead(404).end();
    try{res.writeHead(200,{'content-type':path.endsWith('.wasm')?'application/wasm':'text/javascript'}).end(await readFile(join(pkg,basename(path))));}catch{res.writeHead(404).end();}
  });
  await new Promise((ok,bad)=>{server.once('error',bad);server.listen(0,'127.0.0.1',ok);});
  const origin='http://127.0.0.1:'+server.address().port;report.origin=origin;
  ws=new bundle.wsServer({server});ws.on('connection',route.route);
  const cache=process.env.HOME+'/.cache/ms-playwright';
  const binary=process.env.LKJSTR_CHROME??join(cache,(await readdir(cache)).filter(x=>x.startsWith('chromium-')).sort().pop(),'chrome-linux64/chrome');
  browser=await chromium.launch({executablePath:binary,args:['--no-sandbox']});
  const context=await browser.newContext();
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));
  await page.goto(origin);
  await page.evaluate(()=>{
    window.messages=[];window.rows=[];window.seen=[];
    window.worker=new Worker('/worker.js',{type:'module'});
    window.worker.onerror=e=>window.messages.push({t:'worker-error',message:e.message});
    window.worker.onmessage=e=>{
      const m=e.data;if(window.messages.length<1000)window.messages.push(m);
      if(m.sub!=='live')return;
      if(m.t==='rows')window.rows=m.rows;
      if(m.t==='patch')for(const op of m.ops){
        if(op.op==='remove')window.rows=window.rows.filter(r=>r.key!==op.key);
        if(op.op==='update')window.rows=window.rows.map(r=>r.key===op.row.key?op.row:r);
        if(op.op==='insert'){const i=op.before===null?window.rows.length:window.rows.findIndex(r=>r.key===op.before);window.rows.splice(i<0?window.rows.length:i,0,...op.rows);}
      }
      for(const row of window.rows)if(!window.seen.includes(row.key)&&window.seen.length<100)window.seen.push(row.key);
    };
  });
  await page.waitForFunction(()=>window.messages.some(m=>m.t==='ready'),null,{timeout:15_000});
  report.ready=await page.evaluate(()=>window.messages.find(m=>m.t==='ready'));
  await page.evaluate(({origin,pubkey})=>{
    const send=m=>window.worker.postMessage(m);
    send({t:'configure',config:{language:'en',heuristics:false,prefetch:false}});
    send({t:'relays',relays:['a','b','c'].map(p=>({url:origin.replace('http:','ws:')+'/'+p,read:true,write:false,search:false}))});
    send({t:'open',sub:'live',query:{source:'home',account:pubkey}});
    send({t:'hint',hint:{visibleSubs:['live'],pageHidden:false,idle:false,saveData:false}});
    send({t:'window',sub:'live',anchor:'top',before:0,after:60});
  },{origin,pubkey:fixture.pubkey});
  const initial=await wait(()=>page.evaluate(id=>window.seen.includes(id),route.old.id),10_000);
  check('initial signed B-only note reaches the production projection',initial);
  if(!initial)throw Error('initial route fixture did not establish verified data');
  route.disconnect();
  const fallback=await wait(()=>route.heads().some(q=>q.route==='/c'&&q.eoseAt!==null),8000);
  check('empty permitted C reader takes the disconnected slot',fallback);
  const recovered=await wait(()=>!!route.recovery,8000);
  check('B reconnects and answers its resumed verified-data gap',recovered,route.recovery?.wire);
  if(!recovered)throw Error('B never completed the recovery fixture');
  report.recovery=route.recovery;report.offlineAt=route.disconnectedAt;
  await pause(600);report.beforeLater=route.heads().map(q=>({route:q.route,wire:q.wire,at:q.at}));
  report.laterOfferedAt=Date.now();route.offer();
  const arrived=await wait(()=>page.evaluate(id=>window.seen.includes(id),route.later.id),5000);
  check('recovered route remains owned long enough to deliver a later unique note',route.newDeliveries>0);
  check('later B-only signed note reaches the production projection',arrived);
  report.final=await page.evaluate(()=>({ids:window.rows.map(r=>r.key),seen:window.seen,errors:window.messages.filter(m=>m.t==='worker-error')}));
  const current=route.heads().map(q=>q.route);report.finalHeadRoutes=current;
  check('settled live readers remain bounded to two routes',new Set(current).size<=2,current);
  check('prior note remains without duplicate projected rows',report.final.ids.includes(route.old.id)&&new Set(report.final.ids).size===report.final.ids.length);
  await page.evaluate(()=>{window.worker.postMessage({t:'close',sub:'live'});window.worker.postMessage({t:'detach'});});
  check('closing the last view releases all owned Home requests',await wait(()=>route.heads().length===0,3000));
  await page.evaluate(()=>window.worker.terminate());
}catch(error){report.failure=String(error);console.error(report.failure);}
finally{
  if(page&&!report.final)try{report.final=await page.evaluate(()=>({ids:window.rows?.map(r=>r.key),messages:window.messages}));}catch{}
  await browser?.close().catch(error=>report.errors.push('browser cleanup: '+String(error)));route?.close();
  if(ws){for(const socket of ws.clients)socket.terminate();await new Promise(ok=>ws.close(ok));}
  if(server?.listening){server.closeAllConnections();await new Promise(ok=>server.close(ok));}
  if(temporary)await rm(temporary,{recursive:true,force:true});
  report.cleanup={browser:!browser?.isConnected(),server:!server?.listening,fixtureSockets:route?.openSockets??0,temporaryRemoved:true};
  report.fixtureErrors=route?.errors??[];
  report.finishedAt=new Date().toISOString();report.loadEnd=loadavg();report.durationMs=Date.now()-Date.parse(report.startedAt);
  report.ok=!report.failure&&!report.errors.length&&!report.fixtureErrors.length&&!report.final?.errors?.length&&report.checks.length===8&&report.checks.every(c=>c.ok);
  await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({out,ok:report.ok,failure:report.failure,durationMs:report.durationMs,rows:report.final?.ids?.length}));
  if(!report.ok)process.exitCode=1;
}
