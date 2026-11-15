// Headless protocol harness. All traffic is loopback or intercepted fake relays.
import { createHash } from 'node:crypto';
import { assertCoverage, mockMessageKinds } from './engine-contract.mjs';
import { fallback } from './engine-fallback.mjs';
import { coldStart } from './engine-cold-start.mjs';
import { conformance } from './engine-conformance.mjs';
import { createServer } from 'node:http';
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { chromium } from 'playwright-core';
import bundle from 'playwright-core/lib/utilsBundle';
import { fakeRelay } from './browser-relay.mjs';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
const root = resolve('tmp/engine-pkg'), out = resolve('tmp/engine-harness');
await mkdir(out, { recursive: true });
const boot = `import init,{start} from './lkjstr_engine.js'; const queued=[];self.onmessage=e=>queued.push(e);await init(); self.engineHandle=start();const input=self.onmessage;self.onmessage=e=>{if(e.data.t==='test.advance')self.engineHandle.advance_time(e.data.ms);else if(e.data.t==='test.relays')self.engineHandle.set_test_relays(e.data.relays);else input(e);};for(const e of queued)self.onmessage(e);`;
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  if (path === '/') return res.writeHead(200, {'content-type':'text/html'}).end('<!doctype html><title>Engine harness</title>');
  if (path === '/bench.js') return res.writeHead(200, {'content-type':'text/javascript'}).end(`import init,{benchmark} from './lkjstr_engine.js';await init();postMessage(benchmark());`);
  if (path === '/shared.js') return res.writeHead(200, {'content-type':'text/javascript'}).end(`import init,{start_shared} from './lkjstr_engine.js';const queued=[];self.onconnect=e=>queued.push(e);await init();self.engineHandle=start_shared();for(const e of queued)self.onconnect(e);`);
  if (path === '/worker.js') return res.writeHead(200, {'content-type':'text/javascript'}).end(boot);
  if(path.startsWith('/transport/')) {
    const name=path.slice('/transport/'.length);
    const base=['worker.js','shared.js','transport.js'].includes(name)?resolve('engine'):root;
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
const context = await browser.newContext();
const fake = fakeRelay(), errors = [], checks = {};
const bunker=spawn('cargo',['run','-q','-p','lkjstr-core','--example','engine-bunker'],{stdio:['pipe','pipe','pipe']});
bunker.stderr.resume();
const bunkerLines=createInterface({input:bunker.stdout})[Symbol.asyncIterator]();
const bunkerKey=JSON.parse((await bunkerLines.next()).value).pubkey;
let rpcChain=Promise.resolve();
function bunkerRoute(ws) {
  let sub;
  ws.on('message',raw=>{
    const msg=JSON.parse(String(raw));
    if(msg[0]==='REQ')sub=msg[1];
    if(msg[0]==='EVENT') rpcChain=rpcChain.then(async()=>{
      bunker.stdin.write(`${JSON.stringify(msg[1])}\n`);
      const event=JSON.parse((await bunkerLines.next()).value);
      if(ws.readyState===1)ws.send(JSON.stringify(['EVENT',sub,event]));
    });
  });
}
const wsServer=new bundle.wsServer({server});
wsServer.on('connection',(ws,req)=>{if(req.url==='/bunker'){return bunkerRoute(ws);}fake.route({send:(text)=>ws.send(text),onMessage:(fn)=>ws.on('message',fn),onClose:(fn)=>ws.on('close',fn)});});
await context.route('**/*', (r) => {
  if(r.request().url().startsWith('https://nip96.engine.test/')) {
    if(r.request().url().endsWith('/upload'))return r.fulfill({status:404,body:''});
    if(r.request().url().endsWith('nip96.json'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({api_url:'https://nip96.engine.test/api'})});
    const body=r.request().postDataBuffer();
    if(!body?.includes(Buffer.from([1,2,3,4])))return r.fulfill({status:400,body:''});
    const hash=createHash('sha256').update(Buffer.from([1,2,3,4])).digest('hex');
    return r.fulfill({status:201,contentType:'application/json',body:JSON.stringify({status:'success',nip94_event:{tags:[['url',`https://nip96.engine.test/${hash}.png`],['ox',hash],['m','image/png']]}})});
  }
  if(r.request().url()==='https://media.engine.test/upload') {
    const hash=createHash('sha256').update(r.request().postDataBuffer()).digest('hex');
    return r.fulfill({status:201,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({url:`https://media.engine.test/${hash}.png`,sha256:hash,type:'image/png',size:4})});
  }
  return r.request().url().startsWith(origin) ? r.continue() : r.abort();
});
const page = await context.newPage();page.on('pageerror',(e)=>errors.push(String(e)));
const sentKinds=new Set();
const send = (message) => {sentKinds.add(message.t); return page.evaluate((m)=>window.worker.postMessage(m),message);};
const wait = (predicate, arg) => page.waitForFunction(predicate,arg,{timeout:15000});
const check = (name,ok) => { checks[name]=ok?'ok':'FAIL'; if (!ok) throw new Error(name); };
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
  const signer = spawn('cargo',['run','-q','-p','lkjstr-core','--example','engine-fixtures'],{stdio:['pipe','pipe','pipe']});
  signer.stderr.resume();
  const lines=createInterface({input:signer.stdout})[Symbol.asyncIterator]();
  const data=JSON.parse((await lines.next()).value);
  page.on('close',()=>signer.stdin.end());
  // Select fixture fields without assuming a fixed fixture key.
  const all=[];const walk=(v)=>{if(v&&typeof v==='object'){if(v.id&&v.sig&&v.kind!==undefined)all.push(v);else Object.values(v).forEach(walk);}};walk(data);
  const note=all.find((e)=>e.kind===1);if(!note)throw new Error('fixture has no note');
  all.forEach((e)=>fake.add(e));
  await send({t:'test.relays',relays:[origin.replace('http:','ws:')]});
  await send({t:'heartbeat'});
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
  await send({t:'act',req:'discover',action:{a:'account.add',how:'extension'}});
  await wait(()=>window.messages.some(m=>m.t==='getPublicKey'&&m.req==='discover'));
  await send({t:'publicKey',req:'discover',pubkey:note.pubkey});
  await wait(()=>window.messages.some(m=>m.t==='result'&&m.req==='discover'&&m.ok));
  await send({t:'act',req:'publish',action:{a:'publish',as:note.pubkey,what:{k:'note',draft:{text:'published through sign bridge #Nostr'}}}});
  await wait(()=>window.messages.some((m)=>m.t==='sign'&&m.req==='publish'));
  const unsigned=await page.evaluate(()=>window.messages.find((m)=>m.t==='sign').event);
  check('finished publication derives hashtag tags before signing',JSON.parse(unsigned).tags.some(t=>t[0]==='t'&&t[1]==='nostr'));
  signer.stdin.write(`${unsigned}\n`);
  const signed=JSON.parse((await lines.next()).value);
  await send({t:'signed',req:'publish',event:JSON.stringify(signed)});
  await wait(()=>window.messages.some((m)=>m.t==='result'&&m.req==='publish'));
  const result=await page.evaluate(()=>window.messages.find((m)=>m.t==='result'&&m.req==='publish'));
  check('NIP-07 bridge verifies and publishes with per-relay delivery',result.ok&&result.delivery[0]?.state==='ok'&&fake.published.some((e)=>e.id===signed.id));
  fake.setReading(true);
  await conformance({page,send,wait,check,note,signer,lines,origin,bunkerKey});
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
} catch(e) { checks.failure=String(e); checks.debug=await page.evaluate(()=>window.messages).catch(()=>[]); checks.relay={opened:fake.opened(),connections:fake.connections()}; }
finally {
  await writeFile(join(out,'report.json'),JSON.stringify({checks,errors},null,2));
  bunker.stdin.end();
  await browser.close();wsServer.close();await new Promise((ok)=>server.close(ok));
}
console.log(JSON.stringify({checks,errors}));
if(Object.values(checks).some((v)=>v!=='ok'))process.exitCode=1;
