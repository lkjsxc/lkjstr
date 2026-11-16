// Focused real-Worker regression; select an immutable older package for the before proof.
import { createServer } from 'node:http';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright-core';
import { privateRevocation } from './engine-private-revoke.mjs';
const pkg=resolve(process.env.LKJSTR_ENGINE_PKG??'tmp/engine-pkg');
await mkdir('tmp/temp',{recursive:true});
process.env.TMPDIR??=resolve('tmp/temp');
const base=process.env.HOME+'/.cache/ms-playwright';
const binary=process.env.LKJSTR_CHROME??join(base,(await readdir(base)).filter(x=>x.startsWith('chromium-')).sort().pop(),'chrome-linux64/chrome');
let browser;
const server=createServer(async(req,res)=>{
  const path=new URL(req.url,'http://fixture').pathname;
  if(path==='/')return res.writeHead(200,{'content-type':'text/html'}).end('<!doctype html><title>Private cache fixture</title>');
  if(!['/lkjstr_engine.js','/lkjstr_engine_bg.wasm'].includes(path))return res.writeHead(404).end();
  try{const data=await readFile(join(pkg,path));res.writeHead(200,{'content-type':path.endsWith('.wasm')?'application/wasm':'text/javascript'}).end(data);}
  catch{res.writeHead(404).end();}
});
try {
  await new Promise((ok,bad)=>{server.once('error',bad);server.listen(0,'127.0.0.1',ok);});
  const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({executablePath:binary,args:['--no-sandbox']});
  const context=await browser.newContext();const page=await context.newPage();await page.goto(origin);
  await privateRevocation({page,origin,check:(name,ok)=>{console.log((ok?'ok ':'FAIL ')+name);if(!ok)throw new Error(name);}});
  console.log('PASS private-list commit-boundary regression');
} finally {
  await browser?.close();
  await new Promise(ok=>server.close(ok));
}
