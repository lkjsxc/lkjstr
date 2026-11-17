// Offline request-churn audit. Equality preserves limits and time bounds.
import { readFile,writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { auditTimeline } from './read-score-temporal.mjs';
import { ordered,canonical,family } from './read-score-filters.mjs';
export function auditRequests(requests){
  const exact=new Map(),sets=new Map(),groups=new Map();
  let exactReplay=0,setReplay=0,orderOnlyReplay=0,liveOverlap=0;
  for(const request of requests){
    const a=request.relay+':'+JSON.stringify(ordered(request.filters));
    const b=request.relay+':'+JSON.stringify(canonical(request.filters));
    if(exact.has(a))exactReplay++;
    if(sets.has(b)){
      setReplay++;
      if(!exact.has(a))orderOnlyReplay++;
      if(sets.get(b).some(prior=>(prior.closedAt??Infinity)>request.at))liveOverlap++;
    }
    exact.set(a,(exact.get(a)??0)+1);
    if(!sets.has(b))sets.set(b,[]);
    sets.get(b).push(request);
    const kind=family(request.filters);
    if(!groups.has(kind))groups.set(kind,[]);
    groups.get(kind).push(request);
  }
  const families={};
  for(const [kind,rows] of groups){
    const seen=new Set(),targets=new Set(),perRelay=new Map();
    let repeats=0,targetAsks=0;
    for(const row of rows){
      const key=row.relay+':'+JSON.stringify(canonical(row.filters));
      if(seen.has(key))repeats++;seen.add(key);
      for(const f of row.filters)for(const target of f['#e']??[]){targetAsks++;targets.add(target)}
      if(!perRelay.has(row.relay))perRelay.set(row.relay,[]);
      perRelay.get(row.relay).push(row);
    }
    const stableTargetSets=new Map();
    for(const row of rows){
      const stripped=row.filters.map(({since,until,limit,...f})=>f);
      const key=row.relay+':'+JSON.stringify(canonical(stripped));
      stableTargetSets.set(key,(stableTargetSets.get(key)??0)+1);
    }
    families[kind]={requests:rows.length,sameSetReplay:repeats,targetAsks,uniqueTargets:targets.size,
      repeatedTargetPredicates:[...stableTargetSets.values()].reduce((n,count)=>n+Math.max(0,count-1),0),
      relays:[...perRelay].map(([relay,rs])=>({relay,requests:rs.length,
        uniquePredicates:new Set(rs.map(r=>JSON.stringify(canonical(r.filters)))).size,
        eose:rs.filter(r=>r.eoseAt!==undefined).length,
        closed:rs.filter(r=>r.closedAt!==undefined).length})).sort((a,b)=>b.requests-a.requests)};
  }
  return {requests:requests.length,exactSameRelayReplay:exactReplay,sameSetSameRelayReplay:setReplay,
    orderOnlySameRelayReplay:orderOnlyReplay,overlappingSameSetRequests:liveOverlap,families,
    exactMeaning:'Same relay and all filters, including since/until/limit; subscription IDs excluded',
    orderMeaning:'Same relay, filter envelopes and set members; only array/object order normalized',
    limits:'A repeated predicate is not automatically avoidable: reconnect, failed coverage and legitimate retry remain possible. No relay-failure or generation cause is inferred from payloads alone.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const [input,output]=process.argv.slice(2);
  const report=JSON.parse(await readFile(input,'utf8'));
  const audit={...auditRequests(report.requests),timeline:auditTimeline(report.requests)};
  await writeFile(output,JSON.stringify(audit,null,2)+'\n');
  console.log(JSON.stringify(audit,null,2));
}
