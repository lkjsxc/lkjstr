// Finite real-Worker storage proof; fresh context, owned loopback assets, no account/signing/network traffic.
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { loadavg } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { validateReplies } from './engine-contract.mjs';
import { storageBoot } from './engine-storage-boot.mjs';
import { storageClient } from './engine-storage-client.mjs';
import { storageCases } from './engine-storage-cases.mjs';
const pkg=resolve(process.env.LKJSTR_ENGINE_PKG??'tmp/engine-pkg');
const output=resolve(process.env.LKJSTR_ENGINE_REPORT??'tmp/engine-storage');
await mkdir(output,{recursive:true});
process.env.TMPDIR=process.env.LKJSTR_TEST_TMPDIR??join(resolve(process.env.CARGO_TARGET_DIR??'target','..'),'tmp');
await mkdir(process.env.TMPDIR,{recursive:true});
const report={startedAt:new Date().toISOString(),loadStart:loadavg(),package:pkg,virtualDeadline:true,
  wasmSha256:createHash('sha256').update(await readFile(join(pkg,'lkjstr_engine_bg.wasm'))).digest('hex'),checks:[]};
const check=(name,ok)=>{report.checks.push({name,ok:!!ok});console.log((ok?'ok ':'FAIL ')+name);};
let server,browser,context,client;
try{
  server=createServer(async(req,res)=>{
    const url=new URL(req.url,'http://fixture');
    if(url.pathname==='/')return res.writeHead(200,{'content-type':'text/html'}).end('<!doctype html><title>Owned storage fixture</title>');
    if(url.pathname==='/storage-worker.js')return res.writeHead(200,{'content-type':'text/javascript'}).end(storageBoot(url.searchParams.get('noidb')==='1'));
    if(!['/lkjstr_engine.js','/lkjstr_engine_bg.wasm'].includes(url.pathname))return res.writeHead(404).end();
    try{res.writeHead(200,{'content-type':url.pathname.endsWith('.wasm')?'application/wasm':'text/javascript'}).end(await readFile(join(pkg,url.pathname)));}
    catch{res.writeHead(404).end();}
  });
  await new Promise((ok,bad)=>{server.once('error',bad);server.listen(0,'127.0.0.1',ok);});
  const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({executablePath:process.env.LKJSTR_CHROME??process.env.HOME+'/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',args:['--no-sandbox']});
  const fresh=async()=>{const c=await browser.newContext();await c.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());return c;};
  context=await fresh();client=await storageClient(context,origin);
  await storageCases(client,check);validateReplies(await client.all(0));validateReplies(await client.all(1));
  await client.close();client=undefined;await context.close();context=undefined;
  context=await fresh();client=await storageClient(context,origin,true);
  await client.send(0,{t:'storage.inspect',req:'no-database'});const result=await client.result('no-database');
  check('missing IndexedDB remains unsupported while origin evidence survives',result.persistedEvents.phase==='unsupported'&&result.origin.phase==='ready');
  validateReplies((await client.all(0)).filter(m=>m.t==='storage'));
  const estimateCalls=(await client.control('fixture.trace')).estimates;
  await client.send(0,{t:'detach'});await client.send(0,{t:'storage.inspect',req:'after-preboot-detach'});
  await client.page.waitForFunction(()=>window.storageControls.some(m=>m.observed?.req==='after-preboot-detach'),undefined,{timeout:5000});
  check('detach before database readiness prevents re-admission',(await client.control('fixture.trace')).estimates===estimateCalls&&!(await client.all(0)).some(m=>m.req==='after-preboot-detach'));

}catch(error){report.failure=String(error).slice(0,2000);console.error(report.failure);}
finally{
  for(const cleanup of [()=>client?.close(),()=>context?.close(),()=>browser?.close(),async()=>{server?.closeAllConnections();if(server?.listening)await new Promise(done=>server.close(done));}]){
    try{await cleanup();}catch{report.cleanup='owned storage fixture cleanup failed';}
  }
  report.finishedAt=new Date().toISOString();report.loadEnd=loadavg();report.seconds=(Date.parse(report.finishedAt)-Date.parse(report.startedAt))/1000;
  report.ok=!report.failure&&!report.cleanup&&report.checks.every(c=>c.ok);
  await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  if(!report.ok)process.exitCode=1;
}
