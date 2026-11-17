// A keep decision is unavailable when evidence or guard comparability is missing.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { hash } from './read-score-model.mjs';
const lower = ['requestsPerWantedNew','connectionsPerWantedNew','duplicatesPerWantedNew','bytesPerWantedNew'];
const artifact = score => score.productSourceHash ?? (Array.isArray(score.build)?hash(score.build):null);
// The native fixture has a zero-denominator warm restart and seven real Engine-input days.
// Compare their absolute costs; a faster warm cache cannot hide a cold or daily regression.
function compareNativeReplay(before, after, problems, movement) {
  if (before.mode !== 'native-actual-engine-effects') return;
  if (!before.traceHash || before.traceHash !== after.traceHash) problems.push('different-or-missing-traceHash');
  const bw = before.weekReplay, aw = after.weekReplay;
  if (!before.warmStoreReplay || !after.warmStoreReplay || !Array.isArray(bw) || !Array.isArray(aw) || bw.length !== 7 || aw.length !== 7) {
    problems.push('native-replay-incomplete'); return;
  }
  const samples = [['warm',before.warmStoreReplay,after.warmStoreReplay],
    ...bw.map((sample,i)=>['day'+(i+1),sample,aw[i]])];
  for (const [name,b,a] of samples) {
    if (b?.metrics?.wantedNew !== a?.metrics?.wantedNew || !Number.isFinite(b?.metrics?.wantedNew)) problems.push(name+'-different-wanted-new');
    const costs = ['requests','connections','duplicateWireEvents','bytes'];
    for (const key of costs) {
      const value = s => key === 'bytes'
        ? (Number.isFinite(s?.metrics?.bytesIn) && Number.isFinite(s?.metrics?.bytesOut) ? s.metrics.bytesIn+s.metrics.bytesOut : null)
        : s?.metrics?.[key];
      const from=value(b),to=value(a),label=name+'.'+key;
      if (!Number.isFinite(from) || !Number.isFinite(to)) { problems.push('metric-unavailable-'+label); continue; }
      movement.push({key:label,before:from,after:to,relative:from===0?(to===0?0:1):(to-from)/from,improves:to<from});
      if (to>from) problems.push('cost-regression-'+label);
    }
    for (const key of ['firstScreenMs','visibleCompleteMs']) {
      const from=b?.[key],to=a?.[key],label=name+'.'+key;
      if (!Number.isFinite(from) || !Number.isFinite(to)) { problems.push('metric-unavailable-'+label); continue; }
      movement.push({key:label,before:from,after:to,relative:from===0?(to===0?0:1):(to-from)/from,improves:to<from});
      if (to>from) problems.push('first-screen-regression-'+label);
    }
    const from=b?.recall?.ratio,to=a?.recall?.ratio,label=name+'.recall';
    if (!Number.isFinite(from) || !Number.isFinite(to)) problems.push('recall-unavailable-'+name);
    else {
      movement.push({key:label,before:from,after:to,relative:from===0?(to===0?0:1):(to-from)/from,improves:to>from});
      if (to<from) problems.push('recall-regression-'+name);
    }
  }
}
export function compareScore(before, after, changeId = null) {
  const problems = [];
  for (const key of ['workloadHash','witnessHash','initialStoreHash','mode']) {
    if (!before[key] || before[key] !== after[key]) problems.push('different-or-missing-' + key);
  }
  if (String(before.mode).startsWith('public')) {
    if (!before.candidateScopeFrozen || !after.candidateScopeFrozen || !before.candidateScopeHash || before.candidateScopeHash !== after.candidateScopeHash) problems.push('candidate-scope-unfrozen-or-different');
    // A fixed witness set does not freeze a live latest-N answer. Posts age out
    // while the relays receive new ones, even when the exact filter is unchanged.
    const b = Date.parse(before.started), a = Date.parse(after.started);
    const duration = Math.max(600, (before.requestedSeconds ?? 300) + (after.requestedSeconds ?? 300)) * 1000;
    if (!Number.isFinite(b) || !Number.isFinite(a)) problems.push('public-capture-time-unavailable');
    else if (Math.abs(a - b) > duration) problems.push('public-capture-windows-too-far-apart');
  }
  if (before.complete !== true || after.complete !== true) problems.push('incomplete-traffic');
  const br = before.recall?.ratio, ar = after.recall?.ratio;
  if (!Number.isFinite(br) || !Number.isFinite(ar)) problems.push('recall-unavailable');
  else if (ar < br) problems.push('recall-regression');
  if (!Number.isFinite(before.firstScreenMs) || !Number.isFinite(after.firstScreenMs)) problems.push('first-screen-unavailable');
  else if (after.firstScreenMs > before.firstScreenMs) problems.push('first-screen-regression');
  const movement = [];
  for (const key of lower) {
    const b = before.metrics?.[key], a = after.metrics?.[key];
    if (!Number.isFinite(b) || !Number.isFinite(a)) { problems.push('metric-unavailable-' + key); continue; }
    movement.push({key,before:b,after:a,relative:b===0?(a===0?0:1):(a-b)/b,improves:a<b});
    if (a>b) problems.push('cost-regression-' + key);
  }
  if (Number.isFinite(br) && Number.isFinite(ar)) movement.push({key:'recall',before:br,after:ar,
    relative:br===0?(ar===0?0:1):(ar-br)/br,improves:ar>br});
  if (Number.isFinite(before.firstScreenMs) && Number.isFinite(after.firstScreenMs)) movement.push({
    key:'firstScreenMs',before:before.firstScreenMs,after:after.firstScreenMs,
    relative:before.firstScreenMs===0?(after.firstScreenMs===0?0:1):(after.firstScreenMs-before.firstScreenMs)/before.firstScreenMs,
    improves:after.firstScreenMs<before.firstScreenMs});
  compareNativeReplay(before,after,problems,movement);
  const beforeProductHash=artifact(before),afterProductHash=artifact(after);
  return { changeId,beforeProductHash,afterProductHash,actualChange:!!beforeProductHash&&!!afterProductHash&&beforeProductHash!==afterProductHash, comparable:!problems.some(p=>!p.includes('regression')), keep:problems.length===0&&movement.some(m=>m.improves),
    problems,movement,movedTwoPercent:movement.some(m=>Math.abs(m.relative)>=0.02),
    publicLimit:after.recall?.universeKnown===false?'Witnessed recall only; this cannot prove total public recall':null };
}
export function stopRule(attempts) {
  const tail = attempts.slice(-3);
  return { stop:tail.length===3&&tail.every(x=>x.changeId&&x.actualChange&&x.comparable&&!x.movedTwoPercent)
      &&new Set(tail.map(x=>x.changeId)).size===3&&new Set(tail.map(x=>x.afterProductHash)).size===3,
    attempts:attempts.length, rule:'Three consecutive comparable candidate changes move no scorecard number by at least two percent' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args=process.argv.slice(2),attempts=args.find(v=>v.startsWith('--attempts='));
  const load=async path=>JSON.parse(await readFile(path,'utf8'));
  if(attempts){
    const entries=await load(attempts.slice(11));
    const results=[];
    for(const entry of entries)results.push(compareScore(await load(entry.before),await load(entry.after),entry.changeId));
    console.log(JSON.stringify({attempts:results,...stopRule(results)},null,2));
  }else{
    const paths=args.filter(v=>!v.startsWith('--'));
    if(paths.length!==2)throw Error('Provide before.json after.json, or --attempts=attempts.json');
    const [before,after]=await Promise.all(paths.map(load));
    const result=compareScore(before,after,args.find(v=>v.startsWith('--change='))?.slice(9));
    console.log(JSON.stringify(result,null,2));if(!result.keep)process.exitCode=2;
  }
}
