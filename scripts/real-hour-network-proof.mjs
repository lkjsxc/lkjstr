// Opt-in finite loopback proof; original module bytes are served unchanged behind the startup barrier.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { loadavg } from 'node:os';
import { performance } from 'node:perf_hooks';
import bundle from 'playwright-core/lib/utilsBundle';
const { launchMeasured } = await import(process.env.LKJSTR_PROOF_BROWSER ?? './real-hour-browser.mjs');
import { eventDigest } from './real-hour-network.mjs';
await mkdir('tmp', { recursive: true });
const directory = await mkdtemp(resolve('tmp/host-network-proof-'));
const asset = join(directory, 'assets');
await mkdir(asset);
await writeFile(join(asset, 'index.html'), '<!doctype html><title>Local evidence fixture</title>');
const code=`globalThis.fixtureTrace=[{phase:'script',guard:!!globalThis.__realHour,hostReady:!!globalThis.__realHourHostReady}];
const run=port=>{port.onmessage=event=>{
  fixtureTrace.push({phase:'construct',guard:!!globalThis.__realHour,hostReady:!!globalThis.__realHourHostReady});
  const socket=new WebSocket(event.data);
  socket.onerror=()=>port.postMessage({error:'socket failed'});
  socket.onopen=()=>socket.send(JSON.stringify(['REQ','fixture',{kinds:[1]}]));
  socket.onmessage=message=>{if(JSON.parse(message.data)[0]==='EOSE'){
    socket.send(JSON.stringify(['CLOSE','fixture']));socket.close();port.postMessage('done');
  }};
};port.start?.();};
if(typeof SharedWorkerGlobalScope!=='undefined')self.onconnect=event=>run(event.ports[0]);else run(self);`;
await writeFile(join(asset, 'fixture-worker.js'), code);
const report = { startedUtc: new Date().toISOString(), loadBefore: loadavg(), checks: [], directory };
const at = performance.now();
const wss = new bundle.wsServer({ noServer: true });
const raw = { id: 'a'.repeat(64), pubkey: 'b'.repeat(64), created_at: 100, kind: 1,
  tags: [], content: 'transport fixture body never retained', sig: 'c'.repeat(128) };
let measured, received = 0, forbidden = 0, publicRequests = 0;
wss.on('connection', socket => socket.on('message', bytes => {
  const [type, sub] = JSON.parse(String(bytes));
  if (type !== 'REQ' && type !== 'CLOSE') { forbidden++; socket.close(); return; }
  received++;
  if (type === 'REQ') {
    socket.send(JSON.stringify(['EVENT', sub, raw]));
    socket.send(JSON.stringify(['EOSE', sub]));
  }
}));
const run = (page, url, shared) => page.evaluate(async ({url, shared}) => {
  const source = new URL('/fixture-worker.js', location.href).href;
  const worker = shared ? new SharedWorker(source, {type:'module',name:'host-proof'})
    : new Worker(source, {type:'module',name:'host-proof'});
  (globalThis.fixtureWorkers ??= []).push(worker);
  const port = shared ? worker.port : worker;
  await new Promise((ok,no)=>{
    const timer=setTimeout(()=>no(Error('local module-worker timeout')),15000);
    worker.onerror=event=>{clearTimeout(timer);no(Error(event.message??'worker startup failed'));};
    port.onmessage=event=>{clearTimeout(timer);event.data?.error?no(Error(event.data.error)):ok();};
    port.start?.();port.postMessage(url);
  });
}, {url, shared});
const boundarySnapshot = async () => {
  const result=[];
  for(const [session,target] of measured.cdp.sessions)if(target.type.includes('worker'))
    result.push({type:target.type,...await measured.cdp.evaluate(session,
      '({boundary:globalThis.__realHourWorkerBootstrap,trace:globalThis.fixtureTrace})').catch(error=>({error:String(error)}))});
  return result;
};
try {
  measured = await launchMeasured({ directory: asset, runDirectory: directory,
    onUpgrade:(request,socket,head)=>wss.handleUpgrade(request,socket,head,client=>wss.emit('connection',client)) });
  await measured.context.route('**/*', route => {
    if(new URL(route.request().url()).origin===measured.base)return route.continue();
    publicRequests++;return route.abort();
  });
  const page = measured.context.pages()[0], url = measured.base.replace('http:','ws:');
  await page.goto(measured.base + '/__blank');
  const rejected=await page.evaluate(()=>{
    const blob=URL.createObjectURL(new Blob(['throw Error("must not execute")'],{type:'text/javascript'}));
    let rejected=0;
    for(const Native of [Worker,SharedWorker])for(const [source,options] of [
      ['/fixture-worker.js',{}],[blob,{type:'module'}],['https://example.invalid/worker.js',{type:'module'}],
    ])try{new Native(source,options);}catch(error){if(String(error).includes('same-origin module'))rejected++;else throw error;}
    URL.revokeObjectURL(blob);return rejected;
  });
  assert.equal(rejected,6);report.checks.push('classic/blob/cross-origin constructors fail closed in this measured environment');
  await run(page,url,false);await run(page,url,true);
  report.targets = await measured.cdp.sample();
  report.boundaries = await boundarySnapshot();
  const evidence = measured.cdp.networkEvidence;
  assert.ok(evidence,'host-CDP evidence is available');
  const witness=evidence.forEvent(raw.id);
  assert.equal(witness.length,2);
  assert.deepEqual(witness.map(item=>item.request.targetType).sort(),['shared_worker','worker']);
  for(const item of witness){
    assert.equal(item.digest,eventDigest(raw));assert.equal(item.request.relay,url+'/');
    assert.equal(item.clock,'browser-monotonic');assert.ok(item.at>=item.request.at);
    assert.ok(item.request.eoseAt>=item.at);assert.ok(item.request.closedAt>=item.request.eoseAt);
  }
  assert.equal(report.boundaries.length,2);
  assert.ok(report.boundaries.every(item=>item.boundary.phase==='imported'&&item.boundary.guardBeforeImport
    &&item.boundary.hostReadyBeforeImport&&item.trace.every(phase=>phase.guard&&phase.hostReady)));
  report.checks.push('Worker and SharedWorker have guards before original script and first socket',
    'host release precedes original import and preserves startup ports',
    'both target types have exact receipt/digest/request/EOSE/close evidence');
  const second=await measured.context.newPage();await second.goto(measured.base+'/__blank');
  await run(second,url,true);await measured.cdp.sample();
  const reused=await boundarySnapshot();
  assert.equal(reused.filter(item=>item.type==='shared_worker').length,1);
  assert.equal(reused.find(item=>item.type==='shared_worker').trace.filter(p=>p.phase==='script').length,1);
  assert.equal(evidence.forEvent(raw.id).length,3);
  report.checks.push('a second page reuses the same SharedWorker and receives through its own port');
  assert.ok(evidence.summary().complete);assert.equal(received,6);assert.equal(forbidden,0);assert.equal(publicRequests,0);
  assert.ok(!JSON.stringify(evidence.snapshot()).includes(raw.content));assert.equal(measured.cdp.errors.length,0);
  assert.equal(await readFile(join(asset,'fixture-worker.js'),'utf8'),code);
  report.checks.push('complete bounded capture without retained body','REQ/CLOSE only and no public requests',
    'original module bytes unchanged and zero guard errors');
  report.evidence=evidence.snapshot();report.boundaries=reused;
} catch(error){
  report.failure=String(error.stack??error);process.exitCode=1;
  if(measured){report.guards=measured.cdp.guardStatus();report.errors=measured.cdp.errors;
    report.evidence=measured.cdp.networkEvidence?.snapshot();report.received=received;
    report.boundaries=await boundarySnapshot();report.targets=await measured.cdp.sample();}
} finally {
  try{await measured?.close();}finally{
    for(const socket of wss.clients)socket.terminate();await new Promise(ok=>wss.close(ok));
    await rm(join(directory,'profile'),{recursive:true,force:true});
  }
  report.seconds=(performance.now()-at)/1000;report.loadAfter=loadavg();report.cleanup=true;
  await writeFile(join(directory,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({directory,checks:report.checks.length,seconds:report.seconds,
    loadBefore:report.loadBefore,loadAfter:report.loadAfter,cleanup:report.cleanup,failure:report.failure}));
}
