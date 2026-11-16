// Finite actual production-Worker continuation proof. No Cargo or public traffic.
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { loadavg } from 'node:os';
import { resolve, join, basename } from 'node:path';
import { chromium } from 'playwright-core';
import bundle from 'playwright-core/lib/utilsBundle';
import { historyFixture, historyRoutes } from './engine-history-route-fixture.mjs';
const pkg=resolve(process.env.LKJSTR_ENGINE_PKG??'tmp/engine-pkg');
const out=resolve(process.env.LKJSTR_ENGINE_REPORT??'tmp/history-worker');
await mkdir(out,{recursive:true});
process.env.TMPDIR=process.env.LKJSTR_TEST_TMPDIR??join(resolve(process.env.CARGO_TARGET_DIR??'target','..'),'tmp');
await mkdir(process.env.TMPDIR,{recursive:true});
let loader={module:'/lkjstr_engine.js',wasm:'lkjstr_engine_bg.wasm'};
try{loader=JSON.parse(await readFile(join(pkg,'fixture-loader.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
const report={startedAt:new Date().toISOString(),loadStart:loadavg(),package:pkg,
  wasmSha256:createHash('sha256').update(await readFile(join(pkg,loader.wasm))).digest('hex'),requests:[],checks:[],errors:[]};
const check=(name,ok,observed)=>{report.checks.push({name,ok:!!ok,...(observed===undefined?{}:{observed})});console.log((ok?'ok ':'FAIL ')+name);};
const boot=`const queued=[];self.onmessage=e=>queued.push(e);
const NativeSocket=self.WebSocket,allowed=self.location.origin.replace('http:','ws:');
self.WebSocket=class extends NativeSocket{constructor(url,...rest){const u=new URL(url);if(u.origin!==allowed||!['/a','/b','/c'].includes(u.pathname))throw new Error('blocked non-owned socket');super(url,...rest);}send(text){const m=JSON.parse(text);if(!['REQ','CLOSE'].includes(m[0]))throw new Error('blocked publication');super.send(text);}};
const nativeFetch=self.fetch;self.fetch=(input,options)=>{if(new URL(typeof input==='string'||input instanceof URL?String(input):input.url,self.location.href).origin!==self.location.origin)throw new Error('blocked non-owned fetch');return nativeFetch(input,options);};
const {default:init,start}=await import(${JSON.stringify(loader.module)});await init();self.handle=start();const input=self.onmessage;for(const event of queued)input(event);`;
let browser,server,ws,fixture,route,page;
try{
  fixture=await historyFixture();route=historyRoutes(fixture.events,report.requests);
  report.helperSha256=createHash('sha256').update(await readFile(fixture.bin)).digest('hex');
  server=createServer(async(req,res)=>{
    const path=new URL(req.url,'http://fixture').pathname;
    if(path==='/')return res.writeHead(200,{'content-type':'text/html'}).end('<!doctype html><title>Owned history fixture</title>');
    if(path==='/worker.js')return res.writeHead(200,{'content-type':'text/javascript'}).end(boot);
    if(['/a','/b','/c'].includes(path))return res.writeHead(200,{'content-type':'application/nostr+json'}).end(JSON.stringify({limitation:{max_limit:3}}));
    if(![loader.module,'/'+loader.wasm].includes(path))return res.writeHead(404).end();
    try{res.writeHead(200,{'content-type':path.endsWith('.wasm')?'application/wasm':'text/javascript'}).end(await readFile(join(pkg,basename(path))));}catch{res.writeHead(404).end();}
  });
  await new Promise((ok,bad)=>{server.once('error',bad);server.listen(0,'127.0.0.1',ok);});
  const origin='http://127.0.0.1:'+server.address().port;
  ws=new bundle.wsServer({server});ws.on('connection',route.route);
  const cache=process.env.HOME+'/.cache/ms-playwright';
  const binary=process.env.LKJSTR_CHROME??join(cache,(await readdir(cache)).filter(x=>x.startsWith('chromium-')).sort().pop(),'chrome-linux64/chrome');
  browser=await chromium.launch({executablePath:binary,args:['--no-sandbox']});
  const context=await browser.newContext();
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));
  await page.goto(origin);
  await page.evaluate(()=>{
    window.messages=[];window.rows=[];window.bottom=false;
    window.worker=new Worker('/worker.js',{type:'module'});
    window.worker.onerror=e=>window.messages.push({t:'worker-error',message:e.message});
    window.worker.onmessage=e=>{
      const m=e.data;if(window.messages.length<1000)window.messages.push(m);
      if(m.sub!=='history')return;
      if(m.t==='rows'){window.rows=m.rows;window.bottom=m.atBottom;}
      if(m.t==='patch')for(const op of m.ops){
        if(op.op==='remove')window.rows=window.rows.filter(r=>r.key!==op.key);
        if(op.op==='update')window.rows=window.rows.map(r=>r.key===op.row.key?op.row:r);
        if(op.op==='insert'){const i=op.before===null?window.rows.length:window.rows.findIndex(r=>r.key===op.before);window.rows.splice(i<0?window.rows.length:i,0,...op.rows);}
      }
    };
  });
  await page.waitForFunction(()=>window.messages.some(m=>m.t==='ready'),null,{timeout:15_000});
  report.ready=await page.evaluate(()=>window.messages.find(m=>m.t==='ready'));
  await page.evaluate(({origin,pubkey})=>{
    const send=m=>window.worker.postMessage(m);
    send({t:'configure',config:{language:'en',heuristics:false,prefetch:false}});
    send({t:'relays',relays:['a','b','c'].map(p=>({url:origin.replace('http:','ws:')+'/'+p,read:true,write:false,search:false}))});
    send({t:'open',sub:'history',query:{source:'home',account:pubkey}});
    send({t:'hint',hint:{visibleSubs:['history'],pageHidden:false,idle:false,saveData:false}});
    send({t:'window',sub:'history',anchor:'top',before:0,after:800});
  },{origin,pubkey:fixture.pubkey});
  await page.waitForFunction(()=>window.bottom&&window.rows.length>0,null,{timeout:30_000});
  report.final=await page.evaluate(()=>({ids:window.rows.map(r=>r.key),atBottom:window.bottom,states:window.messages.filter(m=>m.sub==='history'&&m.t==='state').slice(-5),errors:window.messages.filter(m=>m.t==='worker-error')}));
  const head=route.head,tail=route.tail;
  report.fixture={headIds:head?.map(e=>e.id),cursor:head?.at(-1)?.created_at,tailId:tail?.id};
  const continuation=report.requests.filter(r=>r.route==='/b'&&r.filters.some(f=>f.until===head?.at(-1)?.created_at));
  const first = report.requests.find(r=>r.route==='/b'&&r.filters.some(f=>f.kinds?.includes(1)&&!f.until&&!f.since));
  const fullLimit = first?.filters.find(f=>f.kinds?.includes(1))?.limit;
  check('fixture delivered a full signed head and a strictly older unique tail exists',!!head?.length&&typeof fullLimit==='number'&&first?.eoseAt!==null&&first?.ids.length===fullLimit&&tail.created_at<head.at(-1).created_at,
    {headRows:head?.length,wireLimit:fullLimit,distinctReceived:first?.ids.length});
  check('full predecessor receives its inclusive continuation',continuation.length>0);
  check('unique older note is delivered before history exhaustion',!!tail&&report.final.ids.includes(tail.id));
  check('completed-short final tail establishes exhaustion',report.final.atBottom&&continuation.some(r=>r.ids.includes(tail.id)&&r.eoseAt!==null));
  check('all head rows remain and no page or Worker error occurred',head.every(e=>report.final.ids.includes(e.id))&&!report.errors.length&&!report.final.errors.length&&!route.errors.length);
  await page.evaluate(()=>{window.worker.postMessage({t:'close',sub:'history'});window.worker.postMessage({t:'detach'});window.worker.terminate();});
}catch(error){report.failure=String(error);console.error(report.failure);}
finally{
  if(page&&!report.final)try{report.final=await page.evaluate(()=>({ids:window.rows?.map(r=>r.key),atBottom:window.bottom,messages:window.messages}));}catch{}
  await browser?.close().catch(error=>report.errors.push('browser cleanup: '+String(error)));route?.close();
  if(ws){for(const socket of ws.clients)socket.terminate();await new Promise(ok=>ws.close(ok));}
  if(server?.listening)await new Promise(ok=>server.close(ok));
  report.fixtureErrors=route?.errors??[];
  report.finishedAt=new Date().toISOString();report.loadEnd=loadavg();report.durationMs=Date.now()-Date.parse(report.startedAt);
  report.ok=!report.failure&&!report.errors.length&&!report.fixtureErrors.length&&report.checks.length>0&&report.checks.every(c=>c.ok);
  await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({out,ok:report.ok,failure:report.failure,durationMs:report.durationMs,rows:report.final?.ids?.length}));
  if(!report.ok)process.exitCode=1;
}
