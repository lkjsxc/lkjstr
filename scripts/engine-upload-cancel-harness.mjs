// Focused socket proof; select an immutable older Worker package for the before run.
import { createServer } from 'node:http';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright-core';
import { fakeMedia } from './browser-media.mjs';
const pkg=resolve(process.env.LKJSTR_ENGINE_PKG??'tmp/engine-pkg');
await mkdir('tmp/temp',{recursive:true});
process.env.TMPDIR??=resolve('tmp/temp');
const cache=process.env.HOME+'/.cache/ms-playwright';
const binary=process.env.LKJSTR_CHROME??join(cache,(await readdir(cache)).filter(x=>x.startsWith('chromium-')).sort().pop(),'chrome-linux64/chrome');
let browser,media;
const boot="import init,{start} from './lkjstr_engine.js';const Socket=self.WebSocket;self.WebSocket=class extends Socket{constructor(url,...rest){if(new URL(url).hostname!=='127.0.0.1')throw new DOMException('Fixture blocked relay','SecurityError');super(url,...rest);}};const q=[];self.onmessage=e=>q.push(e);await init();const h=start(),input=self.onmessage;self.onmessage=e=>e.data.t==='test.relays'?(typeof h.set_test_relays==='function'?h.set_test_relays(e.data.relays):input({data:{t:'relays',relays:e.data.relays.map(url=>({url,read:true,write:true,search:true}))}})):input(e);for(const e of q)self.onmessage(e);";
const server=createServer(async(req,res)=>{
  const path=new URL(req.url,'http://fixture').pathname;
  if(path==='/')return res.writeHead(200,{'content-type':'text/html'}).end('<!doctype html><title>Upload cancellation fixture</title>');
  if(path==='/worker.js')return res.writeHead(200,{'content-type':'text/javascript'}).end(boot);
  if(!['/lkjstr_engine.js','/lkjstr_engine_bg.wasm'].includes(path))return res.writeHead(404).end();
  try{const data=await readFile(join(pkg,path));res.writeHead(200,{'content-type':path.endsWith('.wasm')?'application/wasm':'text/javascript'}).end(data);}
  catch{res.writeHead(404).end();}
});
async function until(page,predicate,timeout=15000){
  const end=Date.now()+timeout;
  while(Date.now()<end){if(await predicate())return;await page.waitForTimeout(25);}
  throw new Error('focused upload cancellation timed out');
}
try{
  await new Promise((ok,bad)=>{server.once('error',bad);server.listen(0,'127.0.0.1',ok);});
  const origin='http://127.0.0.1:'+server.address().port;
  media=await fakeMedia();media.set('blossom','hang');
  browser=await chromium.launch({executablePath:binary,args:['--no-sandbox']});
  const context=await browser.newContext({ignoreHTTPSErrors:true});
  const allowed=new Set([origin,...Object.values(media.origins)]);
  await context.route('**/*',route=>allowed.has(new URL(route.request().url()).origin)?route.continue():route.abort());
  const page=await context.newPage();await page.goto(origin);
  await page.evaluate(relay=>{
    window.messages=[];window.worker=new Worker('/worker.js',{type:'module'});
    window.worker.onmessage=e=>window.messages.push(e.data);
    window.worker.postMessage({t:'test.relays',relays:[relay]});
  },origin.replace('http:','ws:'));
  const all=()=>page.evaluate(()=>window.messages);
  const send=message=>page.evaluate(m=>window.worker.postMessage(m),message);
  await until(page,async()=> (await all()).some(m=>m.t==='ready'));
  await send({t:'act',req:'fresh-local',action:{a:'account.add',how:'create'}});
  await until(page,async()=> (await all()).some(m=>m.t==='result'&&m.req==='fresh-local'&&m.ok));
  const account=(await all()).filter(m=>m.t==='accounts').at(-1).active;
  await page.evaluate(({account,server})=>window.worker.postMessage({t:'act',req:'pending-upload',action:{a:'upload',as:account,server,name:'fixture.png',mime:'image/png',bytes:new Uint8Array([137,80,78,71,13,10,26,10,1,2,3,4]).buffer}}),{account,server:media.origins.blossom});
  await until(page,()=>media.requests.some(r=>r.method==='PUT'&&r.path==='/upload'));
  const request=media.requests.find(r=>r.method==='PUT'&&r.path==='/upload');
  console.log('ok real loopback upload is pending');
  await send({t:'upload.cancel',req:'pending-upload'});
  await send({t:'stats',req:'after-cancel'});
  await until(page,async()=> (await all()).some(m=>m.t==='stats'&&m.req==='after-cancel'));
  const deadline=Date.now()+3000;
  while(!request.closed&&Date.now()<deadline)await page.waitForTimeout(25);
  const results=(await all()).filter(m=>m.t==='result'&&m.req==='pending-upload');
  if(!request.closed||request.complete||results.length!==1||results[0].ok||results[0].cancelled!==true)throw new Error('cancel did not close the socket with exactly one explicit terminal acknowledgement');
  console.log('ok cancellation closes the socket and acknowledges exactly once');
  await send({t:'upload.cancel',req:'pending-upload'});
  await send({t:'stats',req:'after-repeat'});
  await until(page,async()=> (await all()).some(m=>m.t==='stats'&&m.req==='after-repeat'));
  if((await all()).filter(m=>m.t==='result'&&m.req==='pending-upload').length!==1)throw new Error('repeated cancellation emitted another result');
  console.log('PASS real Worker upload cancellation');
}finally{
  await browser?.close();
  await media?.close();
  await new Promise(ok=>server.close(ok));
}
