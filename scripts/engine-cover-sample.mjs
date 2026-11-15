// Manual, guarded public reads only. Run before and after separately, in that order.
import {spawn} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
const phase=process.argv[2];
if(!['before','after'].includes(phase)) throw new Error('use before or after');
const engine=process.env.LKJSTR_COVER_ENGINE ?? (phase==='before'?'tmp/cover-baseline-engine':'tmp/engine-pkg');
const relays='wss://yabu.me/,wss://nos.lol/,wss://relay.primal.net/';
for(let i=1;i<=3;i++) {
  const output=`tmp/cover-${phase}-${i}.json`;
  const child=spawn(process.execPath,['scripts/engine-orchestration-sample.mjs'],{
    stdio:['ignore','inherit','inherit'],env:{...process.env,
      LKJSTR_SAMPLE_ENGINE:engine,LKJSTR_SAMPLE_RELAYS:relays,LKJSTR_SAMPLE_WARM:'1',
      LKJSTR_SAMPLE_NIP11:'1',LKJSTR_SAMPLE_OUTPUT:output},
  });
  const code=await new Promise(ok=>child.once('exit',ok));
  const r=JSON.parse(await readFile(output,'utf8'));
  if(code||r.wire.metrics.peakConnected<3||r.wire.relays.filter(r=>r.connectionsOpened>0).length<3)
    throw new Error(`invalid three-transport sample ${phase}/${i}`);
}
if(phase==='after') {
  const samples=async p=>Promise.all([1,2,3].map(async i=>JSON.parse(await readFile(`tmp/cover-${p}-${i}.json`,'utf8'))));
  const before=await samples('before'),after=await samples('after');
  const median=values=>values.sort((a,b)=>a-b)[1];
  const summarize=rs=>Object.fromEntries([
    ['requests',median(rs.map(r=>r.wire.metrics.requests))],
    ['duplicates',median(rs.map(r=>r.wire.metrics.duplicateEvents))],
    ['bytesIn',median(rs.map(r=>r.wire.metrics.bytesIn))],
    ['bytesOut',median(rs.map(r=>r.wire.metrics.bytesOut))],
    ['firstScreenMs',median(rs.map(r=>r.firstScreenMs))],
    ['visibleNotes',median(rs.map(r=>r.visibleNoteIds.length))],
    ['rateLimits',rs.reduce((sum,r)=>sum+r.wire.notices.filter(n=>/rate.limit|too many requests|slow down/i.test(JSON.stringify(n.frame))).length,0)],
  ]);
  const b=summarize(before),a=summarize(after);
  const ids=rs=>rs.map(r=>[...r.visibleNoteIds].sort().join(','));
  const sameVisibleIds=new Set([...ids(before),...ids(after)]).size===1;
  const report={before:b,after:a,sameVisibleIds,relays:relays.split(','),
    method:'Three preconnected guarded transports; engine selects its own wants; fresh Worker/IndexedDB; 30 seconds per profile; median of three.',
    targets:{requests:a.requests<=b.requests*.6,duplicates:a.duplicates<=b.duplicates*.5,
      firstScreen:a.firstScreenMs<=b.firstScreenMs*1.1,visible:sameVisibleIds,
      rateLimits:b.rateLimits===0&&a.rateLimits===0},beforeRuns:before,afterRuns:after};
  await writeFile('tmp/cover-public.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({before:b,after:a,sameVisibleIds,targets:report.targets}));
}
