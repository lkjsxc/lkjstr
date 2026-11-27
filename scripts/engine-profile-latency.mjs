// Delayed loopback-only profile regression. Reports note-to-named-row latency.
import { createServer } from 'node:http';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { fixtureProcess } from './engine-fixture-process.mjs';
import { createInterface } from 'node:readline';
import { chromium } from 'playwright-core';
import bundle from 'playwright-core/lib/utilsBundle';
const delayMs = 240;
const signer = fixtureProcess('engine-fixtures', {stdio:['pipe','pipe','pipe']});
signer.stderr.resume();
const lines = createInterface({input:signer.stdout})[Symbol.asyncIterator]();
const data = JSON.parse((await lines.next()).value);
const profile = data.events.find(e=>e.kind===0);
// Signed-in Global admits a live 24-hour preview. Keep the shared historical
// fixture unchanged and sign a recent note from the same profile author.
const { pubkey, kind, content, tags } = data.note;
signer.stdin.write(`${JSON.stringify({pubkey,kind,content,tags,created_at:Math.floor(Date.now()/1000)-60})}\n`);
const note = JSON.parse((await lines.next()).value);
const server = createServer(async (req,res)=>{
  if(req.url==='/')return res.writeHead(200,{'content-type':'text/html'}).end('<!doctype html><title>Profile timing</title>');
  if(req.url==='/worker.js')return res.writeHead(200,{'content-type':'text/javascript'}).end("import init,{start} from './lkjstr_engine.js';const q=[];self.onmessage=e=>q.push(e);await init();const h=start();const f=self.onmessage;self.onmessage=e=>e.data.t==='test.relays'?h.set_test_relays(e.data.relays):f(e);q.forEach(e=>self.onmessage(e));");
  if(!['/lkjstr_engine.js','/lkjstr_engine_bg.wasm'].includes(req.url))return res.writeHead(404).end();
  const bytes=await readFile(`tmp/engine-pkg${req.url}`);
  res.writeHead(200,{'content-type':req.url.endsWith('wasm')?'application/wasm':'text/javascript'}).end(bytes);
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const origin=`http://127.0.0.1:${server.address().port}`;
const sockets=new bundle.wsServer({server});
const timers=new Set(), requests=[];
sockets.on('connection',ws=>ws.on('message',raw=>{
  const [type,sub,...filters]=JSON.parse(String(raw));
  if(type!=='REQ')return;
  requests.push({at:Date.now(),sub,filters});
  const timer=setTimeout(()=>{
    timers.delete(timer);
    if(ws.readyState!==1)return;
    for(const event of [note,profile])if(filters.some(f=>!f.search&&(!f.kinds||f.kinds.includes(event.kind))&&(!f.authors||f.authors.includes(event.pubkey))))ws.send(JSON.stringify(['EVENT',sub,event]));
    ws.send(JSON.stringify(['EOSE',sub]));
  },filters.some(f=>f.search)?1200:delayMs);
  timers.add(timer);
}));
const base=`${process.env.HOME}/.cache/ms-playwright`;
const binary=process.env.LKJSTR_CHROME??`${base}/${(await readdir(base)).filter(s=>s.startsWith('chromium-')).sort().pop()}/chrome-linux64/chrome`;
const browser=await chromium.launch({executablePath:binary,args:['--no-sandbox']});
try {
  const context=await browser.newContext();
  await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
  const page=await context.newPage();await page.goto(origin);
  await page.evaluate(({relay,account,id})=>{
    window.messages=[];window.timing={};window.worker=new Worker('/worker.js',{type:'module'});
    window.worker.onmessage=({data:m})=>{
      window.messages.push(m);
      if(m.t==='ready'){
        window.worker.postMessage({t:'test.relays',relays:[relay]});
        window.worker.postMessage({t:'open',sub:'timing',query:{source:'global',account}});
        for(let i=0;i<6;i++)window.worker.postMessage({t:'open',sub:`background${i}`,query:{source:'search',text:`background${i}`}});
      }
      if(m.sub!=='timing')return;
      const rows=[...(m.rows??[]),...(m.ops??[]).flatMap(op=>op.row?[op.row]:op.rows??[])];
      for(const row of rows)if(row.id===id){
        if(window.timing.note===undefined){
          window.timing.note=performance.now();
          setTimeout(()=>{for(let i=0;i<6;i++)window.worker.postMessage({t:'close',sub:`background${i}`});},1500);
        }
        if(row.author.name==='engine-fixture')window.timing.profile??=performance.now();
      }
    };
  },{relay:origin.replace('http:','ws:'),account:"f".repeat(64),id:note.id});
  await page.waitForFunction(()=>window.timing.profile!==undefined,null,{timeout:20000});
  const timing=await page.evaluate(()=>({delayMs:240,noteToProfileMs:Math.round((window.timing.profile-window.timing.note)*10)/10}));
  await mkdir('tmp/engine-harness',{recursive:true});
  await writeFile(`tmp/engine-harness/profile-latency${process.env.LKJSTR_BASELINE?'-baseline':''}.json`,JSON.stringify(timing,null,2));
  console.log(JSON.stringify(timing));
  if(!process.env.LKJSTR_BASELINE&&timing.noteToProfileMs>delayMs+250)throw new Error('profile hydration exceeded delay plus scheduling allowance');
} catch(error) {
  console.error(JSON.stringify({requests}));throw error;
} finally {
  signer.stdin.end();timers.forEach(clearTimeout);await browser.close();sockets.close();await new Promise(ok=>server.close(ok));
}
