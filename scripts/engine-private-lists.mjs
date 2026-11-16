// Loopback-only list conformance; compiled helpers and Worker bytes are supplied by the gate.
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {loadavg} from 'node:os';
import {resolve,join} from 'node:path';
import {chromium} from 'playwright-core';
import bundle from 'playwright-core/lib/utilsBundle';
import {fakeRelay} from './browser-relay.mjs';
import {listFixture} from './engine-private-list-fixture.mjs';
import {listClient} from './engine-private-list-client.mjs';
import {extensionListCases,commonListCases,removedListCase} from './engine-private-list-cases.mjs';
const pkg=resolve(process.env.LKJSTR_ENGINE_PKG??'tmp/engine-pkg');
const output=resolve(process.env.LKJSTR_ENGINE_REPORT??'tmp/private-lists-loopback');
await mkdir(output,{recursive:true});
process.env.TMPDIR=process.env.LKJSTR_TEST_TMPDIR??join(resolve(process.env.CARGO_TARGET_DIR??'target','..'),'tmp');
await mkdir(process.env.TMPDIR,{recursive:true});
const report={at:new Date().toISOString(),load:loadavg(),package:pkg,checks:[],
  wasmSha256:createHash('sha256').update(await readFile(join(pkg,'lkjstr_engine_bg.wasm'))).digest('hex')};
const check=(name,ok)=>{report.checks.push({name,ok:!!ok});console.log((ok?'ok ':'FAIL ')+name);};
const boot=`const NativeWebSocket=self.WebSocket;
self.WebSocket=class extends NativeWebSocket{constructor(url,...args){
if(new URL(url).origin!==self.location.origin.replace('http:','ws:'))throw Error('owned fixture blocked socket');
super(url,...args);}};
import init,{start} from './lkjstr_engine.js';
const queued=[];self.onmessage=e=>queued.push(e);await init();self.engineHandle=start();
const input=self.onmessage;for(const e of queued)input(e);`;
const fake=fakeRelay();
let server,sockets,browser,fixture;
try{
  fixture=await listFixture();
  server=createServer(async(req,res)=>{
    const path=new URL(req.url,'http://fixture').pathname;
    if(path==='/')return res.writeHead(200,{'content-type':'text/html'}).end('<!doctype html><title>Private list fixture</title>');
    if(path==='/worker.js')return res.writeHead(200,{'content-type':'text/javascript'}).end(boot);
    if(!['/lkjstr_engine.js','/lkjstr_engine_bg.wasm'].includes(path))return res.writeHead(404).end();
    try{res.writeHead(200,{'content-type':path.endsWith('.wasm')?'application/wasm':'text/javascript'})
      .end(await readFile(join(pkg,path)));}catch{res.writeHead(404).end();}
  });
  await new Promise((ok,bad)=>{server.once('error',bad);server.listen(0,'127.0.0.1',ok);});
  const origin='http://127.0.0.1:'+server.address().port;
  sockets=new bundle.wsServer({server});
  sockets.on('connection',(socket,req)=>{
    if(req.url==='/bunker')return fixture.relay(socket);
    fake.route({send:raw=>socket.readyState===1&&socket.send(raw),
      onMessage:fn=>socket.on('message',fn),onClose:fn=>socket.on('close',fn)});
  });
  const base=process.env.HOME+'/.cache/ms-playwright';
  const binary=process.env.LKJSTR_CHROME??join(base,(await readdir(base)).filter(n=>n.startsWith('chromium-')).sort().pop(),'chrome-linux64/chrome');
  browser=await chromium.launch({executablePath:binary,args:['--no-sandbox']});
  for(const kind of ['local','extension','remote']){
    fake.stored.length=0;fake.published.length=0;fixture.calls.length=0;fixture.mode({});
    for(const event of fixture.first.events)fake.add(event);
    const client=await listClient({browser,origin,fixture,fake,kind});
    try{
      if(kind==='extension')await extensionListCases(client,fixture,check);
      await commonListCases(client,fixture,fake,kind,check);
      if(kind==='extension')await removedListCase(client,fixture,fake,check);
      check(kind+' private-list reads publish no ordinary relay EVENT',fake.published.length===0);
    }finally{await client.close();fixture.mode({});fixture.release();}
  }
}catch(error){report.failure=String(error);console.error(report.failure);process.exitCode=1;}
finally{
  await browser?.close();await fixture?.close();
  if(sockets){for(const s of sockets.clients)s.terminate();await new Promise(ok=>sockets.close(ok));}
  if(server?.listening)await new Promise(ok=>server.close(ok));
  report.finishedAt=new Date().toISOString();report.loadEnd=loadavg();
  report.seconds=(Date.parse(report.finishedAt)-Date.parse(report.at))/1000;
  report.ok=!report.failure&&report.checks.every(c=>c.ok);
  await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  if(!report.ok)process.exitCode=1;
  console.log('Private list evidence: '+join(output,'report.json'));
}
