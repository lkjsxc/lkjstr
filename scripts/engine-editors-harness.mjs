// Isolated real-WASM proof. Select the immutable pre-fix package with --before.
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {loadavg} from 'node:os';
import {resolve,join} from 'node:path';
import {chromium} from 'playwright-core';
import {privateEditorLocks} from './engine-editors.mjs';
const pkg=resolve(process.env.LKJSTR_ENGINE_PKG??'tmp/engine-pkg');
const out=resolve(process.env.LKJSTR_ENGINE_REPORT??'tmp/editor-locks');
await mkdir(out,{recursive:true});process.env.TMPDIR??=resolve('tmp/temp');await mkdir(process.env.TMPDIR,{recursive:true});
const report={startedAt:new Date().toISOString(),loadStart:loadavg(),package:pkg,
  wasmSha256:createHash('sha256').update(await readFile(join(pkg,'lkjstr_engine_bg.wasm'))).digest('hex'),checks:[]};
let browser,server;
try {
  server=createServer(async(req,res)=>{
    const path=new URL(req.url,'http://fixture').pathname;
    if(path==='/')return res.writeHead(200,{'content-type':'text/html'}).end('<!doctype html><title>Private editor fixture</title>');
    if(!['/lkjstr_engine.js','/lkjstr_engine_bg.wasm'].includes(path))return res.writeHead(404).end();
    try {res.writeHead(200,{'content-type':path.endsWith('.wasm')?'application/wasm':'text/javascript'}).end(await readFile(join(pkg,path)));}
    catch {res.writeHead(404).end();}
  });
  await new Promise((ok,bad)=>{server.once('error',bad);server.listen(0,'127.0.0.1',ok);});
  const origin='http://127.0.0.1:'+server.address().port;
  const base=process.env.HOME+'/.cache/ms-playwright';
  const binary=process.env.LKJSTR_CHROME??join(base,(await readdir(base)).filter(n=>n.startsWith('chromium-')).sort().pop(),'chrome-linux64/chrome');
  browser=await chromium.launch({executablePath:binary,args:['--no-sandbox']});
  const page=await browser.newPage();await page.goto(origin);
  await privateEditorLocks({page,origin,before:process.argv.includes('--before'),check(name,ok) {
    report.checks.push({name,ok:Boolean(ok)});console.log((ok?'ok ':'FAIL ')+name);
  }});
} catch(error) {report.failure=String(error);console.error(report.failure);}
finally {
  try {await browser?.close();} finally {
    if(server?.listening)await new Promise(ok=>server.close(ok));
    report.finishedAt=new Date().toISOString();report.loadEnd=loadavg();
    report.ok=!report.failure&&report.checks.every(c=>c.ok);
    await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
    if(!report.ok)process.exitCode=1;
  }
}
