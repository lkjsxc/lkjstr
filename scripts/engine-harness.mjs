import { checkExtensionBridge } from './engine-signer-ownership.mjs';
import { createHash } from 'node:crypto';
import { loadavg } from 'node:os';
import { fixtureProcess } from './engine-fixture-process.mjs';
import { continuityRelay } from './engine-continuity-relay.mjs';
import { installContinuityProbe, captureContinuity } from './engine-continuity-probe.mjs';
import { assertCoverage, mockMessageKinds, validateReplies } from './engine-contract.mjs';
import { fallback } from './engine-fallback.mjs';
import { coldStart } from './engine-cold-start.mjs';
import { ownerRelays, localDiscovery, continuity } from './engine-feedback.mjs';
import { conformance } from './engine-conformance.mjs';
import { uploadReview } from './engine-upload-review.mjs';
import { uploadCancel } from './engine-upload-cancel.mjs';
import { privateRevocation } from './engine-private-revoke.mjs';
import { timeRail } from './engine-time-rail.mjs';
import { absoluteTimeWindow, newerTimeRelay } from './engine-time-window.mjs';
import { rich } from './engine-rich.mjs';
import { createServer } from 'node:http';
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { chromium } from 'playwright-core';
import bundle from 'playwright-core/lib/utilsBundle';
import { fakeRelay } from './browser-relay.mjs';
import { fakeBunker } from './browser-bunker.mjs';
import { createInterface } from 'node:readline';
import { checkIdleTicks, noteOutboxProtocol, workerBoot } from './engine-harness-boot.mjs';
const root = resolve(process.env.LKJSTR_ENGINE_PKG ?? 'tmp/engine-pkg'), out = resolve(process.env.LKJSTR_ENGINE_REPORT ?? 'tmp/engine-harness');
const run = { startedAt: new Date().toISOString(), loadStart: loadavg(), package: root, diagnosticFixtureClock: process.env.LKJSTR_CONTINUITY_DIAGNOSTIC==='1', wasmSha256: createHash('sha256').update(await readFile(join(root, 'lkjstr_engine_bg.wasm'))).digest('hex') };let continuityEvidence;
await mkdir(out, { recursive: true });
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  if (path === '/') return res.writeHead(200, {'content-type':'text/html'}).end('<!doctype html><title>Engine harness</title>');
  if (path === '/absolute-time') return res.writeHead(200, {'content-type':'application/nostr+json'}).end('{"limitation":{"max_limit":3,"max_subscriptions":8}}');
  if (path === '/bench.js') return res.writeHead(200, {'content-type':'text/javascript'}).end(`import init,{benchmark} from './lkjstr_engine.js';await init();postMessage(benchmark());`);
  if (path === '/shared.js') return res.writeHead(200, {'content-type':'text/javascript'}).end(`import init,{start_shared} from './lkjstr_engine.js';const queued=[];self.onconnect=e=>queued.push(e);await init();self.engineHandle=start_shared();for(const e of queued)self.onconnect(e);`);
  if (path === '/worker.js' || path === '/archive-worker.js') return res.writeHead(200, {'content-type':'text/javascript'}).end(workerBoot(path, origin));
  if(path.startsWith('/transport/')) {
    const name=path.slice('/transport/'.length);
    const base=['worker.js','shared.js','transport.js','transport-avatars.js'].includes(name)?resolve('engine'):root;
    if(name.includes('/'))return res.writeHead(403).end();
    try {const data=await readFile(join(base,name));return res.writeHead(200,{'content-type':name.endsWith('.wasm')?'application/wasm':'text/javascript'}).end(data);}catch{return res.writeHead(404).end();}
  }
  const file = join(root, path);
  if (!file.startsWith(`${root}/`)) return res.writeHead(403).end();
  try { const data = await readFile(file); res.writeHead(200, {'content-type':extname(file)==='.wasm'?'application/wasm':extname(file)==='.json'?'application/json':'text/javascript'}).end(data); }
  catch { res.writeHead(404).end(); }
});
await new Promise((ok) => server.listen(0,'127.0.0.1',ok));
const origin = `http://127.0.0.1:${server.address().port}`;
const base = `${process.env.HOME}/.cache/ms-playwright`;
const binary = process.env.LKJSTR_CHROME ?? `${base}/${(await readdir(base)).filter((s)=>s.startsWith('chromium-')).sort().pop()}/chrome-linux64/chrome`;
const browser = await chromium.launch({executablePath:binary,args:['--no-sandbox']});
const context = await browser.newContext({ignoreHTTPSErrors:true});
const history=[], historyTrace=continuityRelay(history), historyRequests=historyTrace.filters;
const timeRelay = newerTimeRelay(), fake = fakeRelay(), authFake = fakeRelay({requireAuth:true}), errors = [], checks = {};
const channelRequests=[];
const channelFake=fakeRelay({request(ws,sub,filters){
  for(const f of filters){
    if(channelRequests.length<2000)channelRequests.push(f);
    const events=channelFake.stored.filter(e=>(!f.ids||f.ids.includes(e.id))&&(!f.authors||f.authors.includes(e.pubkey))&&(!f.kinds||f.kinds.includes(e.kind))&&(f.until===undefined||e.created_at<=f.until)&&(f.since===undefined||e.created_at>=f.since)&&Object.entries(f).filter(([k])=>k.startsWith('#')).every(([k,v])=>e.tags.some(t=>t[0]===k.slice(1)&&v.includes(t[1])))).sort((a,b)=>b.created_at-a.created_at||b.id.localeCompare(a.id)).slice(0,f.limit??200);
    for(const e of events)ws.send(JSON.stringify(['EVENT',sub,e]));
  }
  ws.send(JSON.stringify(['EOSE',sub]));return true;
}});
channelFake.requests=channelRequests;
const bunker=await fakeBunker();
const bunkerKey=bunker.pubkey, wsServer=new bundle.wsServer({server});
wsServer.on('connection',(ws,req)=>{if(req.url==='/bunker'){return bunker.route(ws);}if(req.url==='/continuity')return historyTrace.route(ws,req.url);const target=req.url.startsWith('/auth-')?authFake:req.url==='/channels'?channelFake:req.url==='/absolute-time'?timeRelay.relay:fake;target.route({send:(text)=>{if(req.url==='/channels'&&JSON.parse(text)[0]==='OK')setTimeout(()=>{if(ws.readyState===1)ws.send(text);},250);else ws.send(text);},onMessage:(fn)=>ws.on('message',fn),onClose:(fn)=>ws.on('close',fn)});});
await context.route('**/*', (r) => {
  if(r.request().url().startsWith('https://nip96.engine.test/')) {
    if(r.request().url().endsWith('/upload'))return r.fulfill({status:404,body:''});
    if(r.request().url().endsWith('nip96.json'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({api_url:'https://nip96.engine.test/api'})});
    const body=r.request().postDataBuffer();
    if(!body?.includes(Buffer.from([1,2,3,4])))return r.fulfill({status:400,body:''});
    const hash=createHash('sha256').update(Buffer.from([1,2,3,4])).digest('hex');
    return r.fulfill({status:201,contentType:'application/json',body:JSON.stringify({status:'success',nip94_event:{tags:[['url',`https://nip96.engine.test/${hash}.png`],['ox',hash],['m','image/png']]}})});
  }
  if(['https://media.engine.test/upload','https://blossom.band/upload'].includes(r.request().url())) {
    const hash=createHash('sha256').update(r.request().postDataBuffer()).digest('hex');
    return r.fulfill({status:201,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({url:`${new URL(r.request().url()).origin}/${hash}.png`,sha256:hash,type:'image/png',size:4})});
  }
  return r.request().url().startsWith(origin) ? r.continue() : r.abort();
});
let continuityPage;
const page = await context.newPage();page.on('pageerror',(e)=>errors.push(String(e)));
const sentKinds=new Set();
const send = (message) => {sentKinds.add(message.t); return page.evaluate((m)=>window.worker.postMessage(m),message);};
const wait = (predicate, arg) => page.waitForFunction(predicate,arg,{timeout:15000});
const check = (name,ok) => { checks[name]=ok?'ok':'FAIL'; console.log(`${ok?'ok':'FAIL'} ${name}`); if (!ok) throw new Error(name); };
async function start() {
  await page.evaluate(() => {
    window.messages=[];window.worker=new Worker('/worker.js',{type:'module'});
    window.worker.onmessage=(e)=>window.messages.push(e.data);
    window.worker.onerror=(e)=>window.messages.push({type:'worker-error',message:e.message});
  });
  await wait(()=>window.messages.some((m)=>m.t==='ready'));
}
try {
  await page.goto(origin);await start();
  check('dedicated Worker starts without a DOM',true);
  const signer = fixtureProcess('engine-fixtures',{stdio:['pipe','pipe','pipe']});
  signer.stderr.resume();
  const lines=createInterface({input:signer.stdout})[Symbol.asyncIterator]();
  const data=JSON.parse((await lines.next()).value);
  page.on('close',()=>signer.stdin.end());
  const all=[];const walk=(v)=>{if(v&&typeof v==='object'){if(v.id&&v.sig&&v.kind!==undefined)all.push(v);else Object.values(v).forEach(walk);}};walk(data);
  const note=all.find((e)=>e.kind===1);if(!note)throw new Error('fixture has no note');
  all.forEach((e)=>fake.add(e));
  await send({t:'test.relays',relays:[origin.replace('http:','ws:')]});
  await absoluteTimeWindow({page,send,wait,check,note,signer,lines,fake,timeRelay,origin});
  await send({t:'heartbeat'});await noteOutboxProtocol(send,wait);
  await send({t:'preview',sub:'global',ids:[]});
  await wait(()=>window.messages.some(m=>m.t==='heartbeat'));
  check('heartbeat is acknowledged by the Worker',true);
  await send({t:'open',sub:'global',query:{source:'global'}});
  await wait(id=>window.messages.some(m=>m.sub==='global'&&((m.t==='rows'&&m.rows.some(r=>r.id===id))||(m.t==='patch'&&m.ops.some(op=>op.row?.id===id||op.rows?.some(r=>r.id===id))))),note.id);
  check('verified fake-relay rows cross the Worker boundary',true);
  await send({t:'open',sub:'same',query:{source:'global'}});
  await wait(()=>window.messages.some((m)=>m.t==='rows'&&m.sub==='same'&&m.rows.length));
  check('two views share one socket',fake.connections()===1);
  await send({t:'open',sub:'diag',query:{source:'diagnostics'}});
  await wait(()=>window.messages.some((m)=>m.t==='rows'&&m.sub==='diag'));
  const stats=await page.evaluate(()=>Object.fromEntries(window.messages.find((m)=>m.t==='rows'&&m.sub==='diag').rows.map(r=>[r.label,JSON.parse(r.value)])));
  check('diagnostics expose queue and relay measurements',stats.verified>0&&stats.relayStatistics.length===1);
  await send({t:'hint',hint:{visibleSubs:[],pageHidden:true,idle:false,saveData:false}});
  await page.waitForTimeout(150);
  check('hidden views release sockets',fake.connections()===0);
  await checkIdleTicks(page,check);
  await send({t:'hint',hint:{visibleSubs:['global','same'],pageHidden:false,idle:false,saveData:false}});
  for(let n=0;n<100&&fake.opened()<2;n++)await page.waitForTimeout(25);
  check('showing views resumes traffic',fake.opened()>=2);
  // Drain real socket callbacks before jumping the simulated engine clock.
  await page.waitForTimeout(500);
  const openedBefore=fake.opened();
  await send({t:'test.advance',ms:3*60*60*1000});
  await send({t:'test.advance',ms:65000});
  for(let n=0;n<100&&fake.opened()<=openedBefore;n++)await page.waitForTimeout(25);
  check('three simulated idle hours reconnect the real Worker socket',fake.opened()>openedBefore);
  const resumedUnsigned={pubkey:note.pubkey,created_at:Math.floor(Date.now()/1000)+3*60*60,kind:1,tags:[],content:'after simulated idle resume'};
  signer.stdin.write(`${JSON.stringify(resumedUnsigned)}\n`);
  const resumed=JSON.parse((await lines.next()).value);fake.add(resumed);
  await wait(id=>window.messages.some(m=>(m.t==='rows'&&m.rows.some(r=>r.id===id))||(m.t==='patch'&&m.ops.some(op=>op.row?.id===id||op.rows?.some(r=>r.id===id)))),resumed.id);
  check('a fresh signed note arrives after the hours-long idle',true);
  let stored=0;
  for(let n=0;n<100&&!stored;n++){
    stored=await page.evaluate(async()=>{
      const db=await new Promise((ok,bad)=>{const r=indexedDB.open('lkjstr-wasm');r.onsuccess=()=>ok(r.result);r.onerror=bad;});
      const n=await new Promise((ok,bad)=>{const r=db.transaction('events').objectStore('events').count();r.onsuccess=()=>ok(r.result);r.onerror=bad;});db.close();return n;
    });if(!stored)await page.waitForTimeout(50);
  }
  check('Worker IndexedDB transaction commits verified events',stored>0);
  fake.setReading(false);await page.evaluate(()=>window.worker.terminate());await start();
  await send({t:'open',sub:'cached',query:{source:'global'}});
  await wait(()=>window.messages.some((m)=>(m.t==='patch'||m.t==='rows')&&m.sub==='cached'&&(m.rows?.length||m.ops?.length)));
  check('cache restarts without relay replay',true);
  await send({t:'test.relays',relays:[origin.replace('http:','ws:')]});
  await checkExtensionBridge({send,wait,page,check,note,signer,lines,fake});
  fake.setReading(true);
  await ownerRelays({page,send,wait,check,note,signer,lines,fake,origin});
  await conformance({page,send,wait,check,note,signer,lines,origin,bunkerKey,bunker,fake,channelFake,authFake});
  await uploadReview({page,send,wait,check,note,signer,lines});
  await uploadCancel({page,send,wait,check,note,signer,lines,bunker,origin});
  await privateRevocation({page,origin,check});
  await rich({page,send,wait,check,note,signer,lines,fake});
  await timeRail({page,send,wait,check,note,signer,lines,fake});
  validateReplies(await page.evaluate(()=>window.messages));
  check('replies satisfy the current frontend contract',true);
  await localDiscovery({page,send,wait,check,start,origin});
  const isolated=await browser.newContext();
  await isolated.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
  continuityPage=await isolated.newPage();continuityPage.on('pageerror',e=>errors.push(String(e)));
  await continuityPage.goto(origin);
  await continuityPage.evaluate(()=>{
    window.messages=[];window.worker=new Worker('/worker.js',{type:'module'});
    window.worker.onmessage=e=>window.messages.push(e.data);
  });
  await continuityPage.waitForFunction(()=>window.messages.some(m=>m.t==='ready'));
  const cpage=continuityPage;await installContinuityProbe(cpage);
  await continuity({page:cpage,
    send:msg=>{sentKinds.add(msg.t);return cpage.evaluate(m=>window.worker.postMessage(m),msg);},
    wait:(predicate,arg)=>cpage.waitForFunction(predicate,arg,{timeout:15000}),
    check,note,signer,lines,origin,history});
  validateReplies(await cpage.evaluate(()=>window.messages));
  continuityEvidence=await captureContinuity(cpage,history);await isolated.close();continuityPage=undefined;
  validateReplies(await page.evaluate(()=>window.messages));
  signer.stdin.end();
  await send({t:'detach'});
  await page.evaluate(()=>window.worker.terminate());
  for(let n=0;n<100&&fake.connections();n++)await page.waitForTimeout(25);
  const other=await context.newPage();await other.goto(origin);
  for(const p of [page,other]) {
    await p.evaluate(()=>{window.sharedMessages=[];window.shared=new SharedWorker('/shared.js',{type:'module',name:'lkjstr-engine-test'});window.shared.port.onmessage=e=>window.sharedMessages.push(e.data);window.shared.port.start();});
    await p.waitForFunction(()=>window.sharedMessages.some(m=>m.t==='ready'));
    await p.evaluate(relay=>{window.shared.port.postMessage({t:'test.relays',relays:[relay]});window.shared.port.postMessage({t:'open',sub:'same',query:{source:'global'}});},origin.replace('http:','ws:'));
    await p.waitForFunction(()=>window.sharedMessages.some(m=>m.t==='rows'||m.t==='patch'));
  }
  for(let n=0;n<100&&fake.connections()!==1;n++)await page.waitForTimeout(25);
  check('two tabs share one engine and relay socket',fake.connections()===1);
  for(const p of [page,other]) await p.waitForFunction(()=>window.sharedMessages.some(m=>m.t==='state'&&m.sub==='same'&&m.state.relaysAsked===1&&m.state.relaysAnswered===1));
  check('shared progress retains internal membership through client routing',true);
  await page.evaluate(()=>window.shared.port.postMessage({t:'hint',hint:{visibleSubs:[],pageHidden:true,idle:false,saveData:false}}));await page.waitForTimeout(100);
  check('hiding one tab preserves the other tab wants',fake.connections()===1);
  await other.evaluate(()=>window.shared.port.postMessage({t:'hint',hint:{visibleSubs:[],pageHidden:true,idle:false,saveData:false}}));
  for(let n=0;n<100&&fake.connections();n++)await page.waitForTimeout(25);
  check('hiding both tabs releases the shared socket',fake.connections()===0);
  await other.close();
  await fallback({context,origin,fake,check});
  const benchmark=await page.evaluate(()=>new Promise((ok,bad)=>{const w=new Worker('/bench.js',{type:'module'});w.onmessage=e=>{w.terminate();ok(e.data);};w.onerror=bad;}));
  await writeFile(join(out,'wasm-benchmark.json'),JSON.stringify(benchmark,null,2));
  check('WASM benchmark indexes 100000 events',benchmark.stored===100000);
  if(process.env.LKJSTR_COLD_START==='1') {
    const coldContext=await browser.newContext();
    await coldContext.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
    const cold=await coldStart({context:coldContext,origin,check});
    await writeFile(join(out,'cold-start.json'),JSON.stringify(cold,null,2));
    await coldContext.close();
  }
  assertCoverage(sentKinds,mockMessageKinds,'mock message');
  check('all message kinds handled by the current mock were driven',true);
  check('no page errors',errors.length===0);
} catch(e) {
  checks.failure=String(e);run.failureAt=new Date().toISOString();
  if(continuityPage) {
    continuityEvidence=await captureContinuity(continuityPage,history,true).catch(error=>({captureError:String(error)}));
    const initial=continuityEvidence.initial;checks.continuity={progress:initial?.progress,n:initial?.rows?.length,unique:new Set(initial?.rows?.map(r=>r.key)).size};
  }
  checks.shared=await Promise.all(context.pages().map(p=>p.evaluate(()=>window.sharedMessages?.filter(m=>m.t==='state').slice(-12))));
  checks.history=historyRequests;checks.debug=await page.evaluate(()=>window.messages.map(m=>m.key?{...m,key:'[redacted]'}:m)).catch(()=>[]);
  checks.relay={opened:fake.opened(),connections:fake.connections()};
} finally {
  run.finishedAt=new Date().toISOString();run.loadEnd=loadavg();
  await writeFile(join(out,'report.json'),JSON.stringify({checks,errors,run},null,2));
  if(history.length)await writeFile(join(out,'continuity.json'),JSON.stringify({run,observation:continuityEvidence,relay:historyTrace.snapshot(),fixtures:history},null,2));
  await bunker.close().catch(error=>{run.cleanupError=String(error);});
  await browser.close();wsServer.close();await new Promise((ok)=>server.close(ok));
}
console.log(JSON.stringify({checks,errors}));
if(Object.values(checks).some((v)=>v!=='ok'))process.exitCode=1;
