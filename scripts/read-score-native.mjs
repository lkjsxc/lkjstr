// Run a previously built fixture executable; record exact code/binary/date/load provenance.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { loadavg } from 'node:os';
import { productSources } from './read-score-source.mjs';
const option=(name,fallback)=>process.argv.find(v=>v.startsWith('--'+name+'='))?.slice(name.length+3)??fallback;
const binary=resolve(option('binary',(process.env.CARGO_TARGET_DIR??'target')+'/debug/examples/engine-read-score'));
const output=resolve(option('output','tmp/read-score-native.json'));
const sources=await productSources();
const started=new Date().toISOString(),initialLoad=loadavg();
const result=spawnSync(binary,[],{encoding:'utf8',maxBuffer:4*1024*1024,timeout:300000});
if(result.status!==0)throw Error('Actual-engine score fixture failed: '+result.stderr);
const report=JSON.parse(result.stdout);
Object.assign(report,{...sources,started,finished:new Date().toISOString(),initialLoad,finalLoad:loadavg(),
  binarySha256:createHash('sha256').update(await readFile(binary)).digest('hex'),
  sourceRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  productTree:execFileSync('git',['rev-parse','HEAD:crates'],{encoding:'utf8'}).trim(),
  worktreeDirty:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()!==''});
await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output,recall:report.recall,metrics:report.metrics,firstScreenMs:report.firstScreenMs}));
