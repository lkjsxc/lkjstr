// Freeze only public relay candidates established by observed sockets or verified public signed hints.
import { readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { queryRelay } from './real-hour-public.mjs';
import { hash } from './read-score-model.mjs';
const [directory,helper,output]=process.argv.slice(2);
if(!directory||!helper||!output)throw Error('Usage: read-score-scope.mjs report-directory verifier output.json');
const root=resolve(directory);
const report=JSON.parse(await readFile(root+'/report.json','utf8'));
const workload=JSON.parse(await readFile(root+'/workload.json','utf8'));
const events=JSON.parse(await readFile(root+'/received-public.json','utf8'));
const hints=await Promise.all(workload.relays.map(relay=>queryRelay(relay,[{kinds:[10002],authors:[workload.account.pubkey,...workload.profiles],limit:4}],10000)));
events.push(...hints.flatMap(probe=>probe.events));
const result=spawnSync(resolve(helper),{input:JSON.stringify(events),encoding:'utf8',maxBuffer:4*1024*1024,timeout:60000});
if(result.status!==0)throw Error('Candidate-hint signature verification failed');
const verified=new Set(JSON.parse(result.stdout).controlVerified);
const people=new Set([workload.account.pubkey,...workload.account.follows]);
const evidence=new Map();
const add=(raw,reason)=>{
  try{const url=new URL(raw);if(url.protocol!=='wss:'||url.username||url.password)return;
    if(!evidence.has(url.href))evidence.set(url.href,new Set());evidence.get(url.href).add(reason)}catch{}
};
for(const url of report.network.relayUrls??[])add(url,'observed-application-socket');
for(const url of workload.relays)add(url,'control-bootstrap');
for(const event of events){
  if(!verified.has(event.id)||!people.has(event.pubkey))continue;
  for(const tag of event.tags??[]){
    if(event.kind===10002&&tag[0]==='r')add(tag[1],'signed-author-relay-list');
    if(['e','p','q'].includes(tag[0])&&tag[2])add(tag[2],'signed-event-hint');
  }
}
if(evidence.size>1024)throw Error('Candidate scope exceeds explicit1024 URL bound');
const urls=[...evidence.keys()].sort();
await writeFile(resolve(output),JSON.stringify({schema:'lkjstr-read-candidates-1',
  source:root,account:workload.account.pubkey,urls,hash:hash(urls),
  hintProbes:hints,evidence:Object.fromEntries([...evidence].sort(([a],[b])=>a.localeCompare(b)).map(([u,r])=>[u,[...r].sort()])),
  note:'Static public sample boundary, not product discovery policy; denied outside candidates invalidate complete traffic claims'},null,2)+'\n');
console.log(JSON.stringify({output:resolve(output),candidates:urls.length,hash:hash(urls)}));
