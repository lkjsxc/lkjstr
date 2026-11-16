// Frozen-package continuity reproduction. No Cargo or account helpers run here.
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { readFile, writeFile, readdir, mkdir, mkdtemp } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { loadavg } from 'node:os';
import { chromium } from 'playwright-core';
import bundle from 'playwright-core/lib/utilsBundle';
import { continuity } from './engine-feedback.mjs';
const pkg=resolve(process.env.LKJSTR_ENGINE_PKG??'tmp/second-before/engine-pkg');
await mkdir('tmp/temp',{recursive:true});process.env.TMPDIR??=resolve('tmp/temp');
const out=await mkdtemp(resolve('tmp/continuity-debug-'));
const startedAt=new Date().toISOString(),start=Date.now(),history=[],requests=[],controls=[],checks={},errors=[];
const report={startedAt,loadStart:loadavg(),package:pkg,wasmSha256:createHash('sha256').update(await readFile(join(pkg,'lkjstr_engine_bg.wasm'))).digest('hex')};
let browser,page,signer,wsServer,connection=0,droppedTrace=0;
const boot="import init,{start} from './lkjstr_engine.js';const Socket=self.WebSocket;self.WebSocket=class extends Socket{constructor(url,...rest){if(new URL(url).hostname!=='127.0.0.1')throw new DOMException('Fixture blocked relay','SecurityError');super(url,...rest);}};const q=[];self.onmessage=e=>q.push(e);await init();self.engineHandle=start();const input=self.onmessage;for(const e of q)input(e);";
const server=createServer(async(req,res)=>{
  const path=new URL(req.url,'http://fixture').pathname;
  if(path==='/')return res.writeHead(200,{'content-type':'text/html'}).end('<!doctype html><title>Continuity fixture</title>');
  if(path==='/worker.js')return res.writeHead(200,{'content-type':'text/javascript'}).end(boot);
  if(!['/lkjstr_engine.js','/lkjstr_engine_bg.wasm'].includes(path))return res.writeHead(404).end();
  try{res.writeHead(200,{'content-type':path.endsWith('.wasm')?'application/wasm':'text/javascript'}).end(await readFile(join(pkg,path)));}
  catch{res.writeHead(404).end();}
});
const elapsed=()=>Date.now()-start;
const record=value=>{if(controls.length<3000)controls.push({at:elapsed(),...value});else droppedTrace++;};
function route(ws,request){
  const client=++connection;record({t:'connect',connection:client,path:request.url});
  const latest=new Map();
  ws.on('close',()=>record({t:'disconnect',connection:client}));
  ws.on('message',raw=>{
    let message;try{message=JSON.parse(raw.toString());}catch{return;}
    if(message[0]==='CLOSE'){
      record({t:'CLOSE',connection:client,sub:message[1]});
      const entry=latest.get(message[1]);if(entry)entry.closeAt=elapsed();return;
    }
    if(message[0]!=='REQ'){record({t:message[0],connection:client});return;}
    const [_,sub,...filters]=message;
    const entry={at:elapsed(),connection:client,sub,filters,sent:0,distinct:0,ids:[],first:null,last:null,eoseAt:null};
    if(requests.length<1000)requests.push(entry);else droppedTrace++;
    latest.set(sub,entry);record({t:'REQ',connection:client,sub});
    for(const filter of filters){
      const events=history.filter(e=>(!filter.kinds||filter.kinds.includes(e.kind))&&(!filter.authors||filter.authors.includes(e.pubkey))&&(!filter.until||e.created_at<=filter.until)&&(!filter.since||e.created_at>=filter.since)&&!filter['#e'])
        .sort((a,b)=>b.created_at-a.created_at||b.id.localeCompare(a.id)).slice(0,filter.limit??200);
      for(const event of events){
        ws.send(JSON.stringify(['EVENT',sub,event]));entry.sent++;
        entry.ids.push(event.id);entry.first??={id:event.id,at:event.created_at};entry.last={id:event.id,at:event.created_at};
      }
      if(events.length){ws.send(JSON.stringify(['EVENT',sub,events[0]]));entry.sent++;}
    }
    entry.ids=[...new Set(entry.ids)];entry.distinct=entry.ids.length;
    ws.send(JSON.stringify(['EOSE',sub]));entry.eoseAt=elapsed();record({t:'EOSE',connection:client,sub});
  });
}
async function until(predicate,ms=5000){
  const end=Date.now()+ms;
  while(Date.now()<end){if(await predicate())return;await page.waitForTimeout(25);}
}
async function capture(){
  if(!page)return;
  report.window=await page.evaluate(()=>({progress:window.continuityProgress,rows:window.continuityRows?.map(r=>({key:r.key,at:r.at})),states:window.messages?.filter(m=>m.sub==='continuity'&&m.t==='state').slice(-4)}));
  await page.evaluate(()=>{
    window.worker.postMessage({t:'stats',req:'failure-stats'});
    window.worker.postMessage({t:'open',sub:'failure-diagnostics',query:{source:'diagnostics'}});
  });
  await until(()=>page.evaluate(()=>window.messages.some(m=>m.t==='stats'&&m.req==='failure-stats')&&window.messages.some(m=>m.t==='rows'&&m.sub==='failure-diagnostics')));
  report.stats=await page.evaluate(()=>window.messages.find(m=>m.t==='stats'&&m.req==='failure-stats')?.stats);
  report.diagnostics=await page.evaluate(()=>Object.fromEntries((window.messages.filter(m=>m.t==='rows'&&m.sub==='failure-diagnostics').at(-1)?.rows??[]).map(r=>[r.label,r.value])));
  report.physical=await page.evaluate(async()=>{
    const db=await new Promise((ok,bad)=>{const r=indexedDB.open('lkjstr-wasm');r.onsuccess=()=>ok(r.result);r.onerror=bad;});
    try{return await new Promise((ok,bad)=>{const tx=db.transaction('events','readonly'),r=tx.objectStore('events').getAllKeys();r.onsuccess=()=>ok(r.result);r.onerror=bad;});}finally{db.close();}
  });
  const visible=new Set(report.window.rows?.map(r=>r.key)),physical=new Set(report.physical);
  report.missingVisible=history.filter(e=>!visible.has(e.id)).map(e=>({id:e.id,at:e.created_at}));
  report.missingPhysical=history.filter(e=>!physical.has(e.id)).map(e=>({id:e.id,at:e.created_at}));
}
try{
  await new Promise((ok,bad)=>{server.once('error',bad);server.listen(0,'127.0.0.1',ok);});
  const origin='http://127.0.0.1:'+server.address().port;
  wsServer=new bundle.wsServer({server});wsServer.on('connection',route);
  signer=spawn(resolve(process.env.LKJSTR_ENGINE_FIXTURE_BIN??'target/debug/examples/engine-fixtures'),[],{stdio:['pipe','pipe','pipe']});
  signer.stderr.resume();const lines=createInterface({input:signer.stdout})[Symbol.asyncIterator]();
  const {note}=JSON.parse((await lines.next()).value);
  const cache=process.env.HOME+'/.cache/ms-playwright';
  const binary=process.env.LKJSTR_CHROME??join(cache,(await readdir(cache)).filter(x=>x.startsWith('chromium-')).sort().pop(),'chrome-linux64/chrome');
  browser=await chromium.launch({executablePath:binary,args:['--no-sandbox']});
  const context=await browser.newContext();await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));await page.goto(origin);
  await page.evaluate(()=>{window.messages=[];window.worker=new Worker('/worker.js',{type:'module'});window.worker.onmessage=e=>window.messages.push(e.data);});
  await page.waitForFunction(()=>window.messages.some(m=>m.t==='ready'));
  await continuity({page,note,signer,lines,origin,history,
    send:message=>page.evaluate(m=>window.worker.postMessage(m),message),
    wait:(predicate,arg)=>page.waitForFunction(predicate,arg,{timeout:15000}),
    check:(name,ok)=>{checks[name]=ok?'ok':'FAIL';console.log((ok?'ok ':'FAIL ')+name);if(!ok)throw new Error(name);}});
  report.passed=true;
}catch(error){report.failure=String(error);process.exitCode=1;}
finally{
  try{await capture();}catch(error){report.captureError=String(error);}
  report.finishedAt=new Date().toISOString();report.durationMs=elapsed();report.loadEnd=loadavg();report.checks=checks;report.errors=errors;report.traceDropped=droppedTrace;
  await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
  await writeFile(join(out,'requests.json'),JSON.stringify({requests,controls},null,2));
  await writeFile(join(out,'fixtures.json'),JSON.stringify(history));
  await browser?.close();signer?.stdin.end();signer?.kill();
  for(const socket of wsServer?.clients??[])socket.terminate();
  if(wsServer)await new Promise(ok=>wsServer.close(ok));
  await new Promise(ok=>server.close(ok));
  console.log(JSON.stringify({out,passed:report.passed??false,failure:report.failure,visible:report.window?.rows?.length,physical:report.physical?.length,missing:report.missingPhysical?.length,durationMs:report.durationMs}));
}
