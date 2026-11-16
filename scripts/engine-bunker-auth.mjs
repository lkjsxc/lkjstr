// Finite real-WASM authorization protocol proof: fresh data, exact loopback guards, no browser navigation.
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { loadavg } from 'node:os';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright-core';
import bundle from 'playwright-core/lib/utilsBundle';
import { fakeRelay } from './browser-relay.mjs';
import { validateReplies } from './engine-contract.mjs';
import { authorizationFixture } from './engine-bunker-auth-fixture.mjs';
import { authorizationClient } from './engine-bunker-auth-client.mjs';
import { authorizationCases } from './engine-bunker-auth-cases.mjs';
import { authorizationBoundaries } from './engine-bunker-auth-boundaries.mjs';
const boundaries=process.argv.includes('--boundaries');
const pkg=resolve(process.env.LKJSTR_ENGINE_PKG??'tmp/engine-pkg');
const output=resolve(process.env.LKJSTR_ENGINE_REPORT??'tmp/bunker-auth');
await mkdir(output,{recursive:true});
process.env.TMPDIR=process.env.LKJSTR_TEST_TMPDIR??join(resolve(process.env.CARGO_TARGET_DIR??'target','..'),'tmp');
await mkdir(process.env.TMPDIR,{recursive:true});
const report={startedAt:new Date().toISOString(),loadStart:loadavg(),package:pkg,virtualDeadline:true,
  boundaries,wasmSha256:createHash('sha256').update(await readFile(join(pkg,'lkjstr_engine_bg.wasm'))).digest('hex'),checks:[]};
const check=(name,ok)=>{report.checks.push({name,ok:!!ok});console.log((ok?'ok ':'FAIL ')+name);};
const boot=`let fixtureClock=0;const nativeDateNow=Date.now.bind(Date),nativePerformanceNow=performance.now.bind(performance);
Date.now=()=>nativeDateNow()+fixtureClock;Object.defineProperty(performance,'now',{value:()=>nativePerformanceNow()+fixtureClock});
const NativeSocket=self.WebSocket;self.WebSocket=class extends NativeSocket{
constructor(url,protocols){if(new URL(url).origin!==self.location.origin.replace('http:','ws:'))throw Error('owned fixture blocks public socket');super(url,protocols);}};
const nativeFetch=self.fetch.bind(self);self.fetch=(input,init)=>{const url=new URL(typeof input==='string'?input:input.url??input,self.location);if(url.origin!==self.location.origin&&!(${boundaries}&&url.origin==='https://zap.fixture.invalid'))return Promise.reject(Error('owned fixture blocks public HTTP'));return nativeFetch(input,init);};
const timers=new Map(),startTimer=self.setTimeout.bind(self),clearTimer=self.clearTimeout.bind(self);
self.setTimeout=(callback,ms,...args)=>{const id=startTimer(()=>{timers.delete(id);callback(...args);},ms);if(ms>=59000&&ms<=60000)timers.set(id,{callback,args,ms});return id;};
self.clearTimeout=id=>{timers.delete(id);clearTimer(id);};
import init,{start_port_host}from './lkjstr_engine.js';const queued=[];self.onmessage=e=>queued.push(e);await init();const handle=start_port_host(),input=self.onmessage;
self.onmessage=e=>{const reply=value=>self.postMessage({...value,fixtureRequest:e.data?.fixtureRequest});
if(e.data?.t==='fixture.hold')reply({t:'fixture.held',ok:handle.hold_public_sign(e.data.account)});
else if(e.data?.t==='fixture.queued')reply({t:'fixture.queued',ok:handle.public_sign_queued()});
else if(e.data?.t==='fixture.release')reply({t:'fixture.released',ok:handle.release_public_sign()});
else if(e.data?.t==='fixture.renew')reply({t:'fixture.renewed',ok:handle.renew_queued_bunker(e.data.account)});
else if(e.data?.t==='fixture.clock'){if(Number.isInteger(e.data.ms)&&e.data.ms>=0&&e.data.ms<=90_000)fixtureClock+=e.data.ms;reply({t:'fixture.clock',now:Date.now()});}
else if(e.data?.t==='fixture.expire'){const delays=[];for(const[id,timer]of [...timers]){timers.delete(id);clearTimer(id);delays.push(timer.ms);timer.callback(...timer.args);}reply({t:'fixture.expired',delays});}
else if(e.data?.t==='fixture.stop'){handle.stop();reply({t:'fixture.stopped',queued:handle.public_sign_queued()});}else input(e);};for(const e of queued)self.onmessage(e);`;
let browser,context,server,sockets,fixture,client,authFetches=0;
const fake=fakeRelay();
try {
  fixture=await authorizationFixture();fake.stored.push(...fixture.first.events);
  server=createServer(async(req,res)=>{
    const path=new URL(req.url,'http://fixture').pathname;
    if(path==='/authorize'){authFetches++;return res.writeHead(200).end('fixture');}
    if(path==='/')return res.writeHead(200,{'content-type':'text/html'}).end('<!doctype html><title>Owned authorization fixture</title>');
    if(path==='/auth-worker.js')return res.writeHead(200,{'content-type':'text/javascript'}).end(boot);
    if(!['/lkjstr_engine.js','/lkjstr_engine_bg.wasm'].includes(path))return res.writeHead(404).end();
    try{res.writeHead(200,{'content-type':path.endsWith('.wasm')?'application/wasm':'text/javascript'}).end(await readFile(join(pkg,path)));}
    catch{res.writeHead(404).end();}
  });
  await new Promise((ok,bad)=>{server.once('error',bad);server.listen(0,'127.0.0.1',ok);});
  const origin='http://127.0.0.1:'+server.address().port;
  sockets=new bundle.wsServer({server});
  sockets.on('connection',(socket,request)=>{
    if(request.url==='/bunker')return fixture.relay(socket);
    fake.route({send:raw=>socket.readyState===1&&socket.send(raw),onMessage:fn=>socket.on('message',fn),onClose:fn=>socket.on('close',fn)});
  });
  browser=await chromium.launch({executablePath:process.env.LKJSTR_CHROME??process.env.HOME+'/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',args:['--no-sandbox']});
  context=await browser.newContext();
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  client=await authorizationClient(context,origin);
  if(boundaries)await authorizationBoundaries({c:client,fixture,fake,origin,check});
  else await authorizationCases({c:client,fixture,fake,origin,check});
  validateReplies(await client.all(0));validateReplies(await client.all(1));
  check('every owned authorization reply satisfies the current additive contract',true);
  check('authorization URLs were neither opened nor fetched',authFetches===0&&context.pages().length===1);
  check('owned fixture helpers completed without errors',fixture.errors.length===0);
} catch(error) {
  // Predicates contain only method/status metadata. Never serialize the challenge URLs or RPC frames.
  report.failure=String(error).slice(0,2000);console.error(report.failure);
} finally {
  for (const cleanup of [()=>client?.close(),()=>context?.close(),()=>browser?.close(),()=>fixture?.close(),async()=>{
    if(sockets){for(const socket of sockets.clients)socket.terminate();await new Promise(done=>sockets.close(done));}
    if(server?.listening)await new Promise(done=>server.close(done));
  }]) {
    try { await cleanup(); } catch { report.cleanup='owned fixture cleanup failed'; }
  }
  report.finishedAt=new Date().toISOString();report.loadEnd=loadavg();
  report.seconds=(Date.parse(report.finishedAt)-Date.parse(report.startedAt))/1000;
  report.ok=!report.failure&&!report.cleanup&&report.checks.every(c=>c.ok);
  await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  if(!report.ok)process.exitCode=1;
}
