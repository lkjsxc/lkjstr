// Offline evidence, not inferred engine decisions. All timestamps are observer epochs.
import { family,canonical } from './read-score-filters.mjs';
const key = row => row.relay + JSON.stringify(canonical(row.filters));
const covered = row => row.eoseAt !== undefined && row.closedAt !== undefined
  && row.eoseAt <= row.closedAt && row.filters.length === 1
  && row.filters[0].limit > row.received.length;
const percentile = (values, fraction) => values.length
  ? [...values].sort((a,b)=>a-b)[Math.floor((values.length-1)*fraction)] : null;
export function auditTimeline(requests) {
  const rows=[...requests].sort((a,b)=>a.at-b.at || a.index-b.index), history=new Map();
  const counts={exactSetReplays:0,priorClosedEoseUntruncated:0,priorCoverageUnknown:0,
    currentClosedBeforeEose:0,currentCompletedBeforeClose:0,closedEoseDuplicateOnly:0,
    closedEoseEmptyReplay:0,newIdsAfterPriorCoverage:0};
  const reasons={}, intervals=[], replays=[], countBuckets=[], seenTargets=new Map();
  const start=rows[0]?.at ?? 0;
  for (const row of rows) {
    if(row.reason)reasons[row.reason]=(reasons[row.reason]??0)+1;
    const fingerprint=key(row), priors=history.get(fingerprint)??[];
    if(priors.length) {
      counts.exactSetReplays++;
      const previous=priors.at(-1), eligible=priors.filter(p=>covered(p)&&p.closedAt<=row.at);
      const priorIds=new Set(eligible.flatMap(p=>p.received));
      const newIds=row.received.filter(id=>!priorIds.has(id));
      const complete=covered(row), earlyClose=row.closedAt!==undefined
        && (row.eoseAt===undefined || row.closedAt<row.eoseAt);
      if(eligible.length)counts.priorClosedEoseUntruncated++; else counts.priorCoverageUnknown++;
      if(earlyClose)counts.currentClosedBeforeEose++;
      if(complete)counts.currentCompletedBeforeClose++;
      if(eligible.length && complete) {
        if(!row.received.length)counts.closedEoseEmptyReplay++;
        else if(!newIds.length)counts.closedEoseDuplicateOnly++;
        else counts.newIdsAfterPriorCoverage+=newIds.length;
      }
      intervals.push(row.at-previous.at);
      replays.push({index:row.index,previous:previous.index,family:family(row.filters),
        atMs:row.at-start,intervalMs:row.at-previous.at,
        closeAfterMs:row.closedAt===undefined?null:row.closedAt-row.at,
        eoseAfterMs:row.eoseAt===undefined?null:row.eoseAt-row.at,
        priorClosedEoseUntruncated:eligible.length>0,closedEoseUntruncated:complete,
        returnedIds:row.received.length,newIdsVersusPriorComplete:eligible.length?newIds.length:null});
    }
    history.set(fingerprint,[...priors,row]);
    if(family(row.filters)==='counts') {
      let seen=seenTargets.get(row.relay);if(!seen){seen=new Set();seenTargets.set(row.relay,seen)}
      const targets=new Set(row.filters.flatMap(f=>f['#e']??[]));
      const additions=[...targets].filter(id=>!seen.has(id));
      countBuckets.push({index:row.index,relay:row.relay,atMs:row.at-start,
        targets:targets.size,newOnRelay:additions.length,repeatedOnRelay:targets.size-additions.length,
        limits:row.filters.map(f=>f.limit??null),timeBounds:row.filters.map(f=>[f.since??null,f.until??null]),
        eoseBeforeClose:row.eoseAt!==undefined && (row.closedAt===undefined||row.eoseAt<=row.closedAt)});
      for(const id of targets)seen.add(id);
    }
  }
  const byFamily={};for(const row of replays){const group=byFamily[row.family]??={replays:0,completedDuplicateOnly:0,completedEmpty:0,unknownPrior:0};
    group.replays++;if(!row.priorClosedEoseUntruncated)group.unknownPrior++;
    else if(row.closedEoseUntruncated&&row.newIdsVersusPriorComplete===0){
      if(row.returnedIds)group.completedDuplicateOnly++;else group.completedEmpty++;
    }
  }
  return {counts,byFamily,closeReasons:reasons,replayIntervalMs:{p50:percentile(intervals,0.5),p95:percentile(intervals,0.95)},
    countCoverage:{requests:countBuckets.length,targetAsks:countBuckets.reduce((n,r)=>n+r.targets,0),
      firstAsksOnRelay:countBuckets.reduce((n,r)=>n+r.newOnRelay,0),
      repeatedAsksOnRelay:countBuckets.reduce((n,r)=>n+r.repeatedOnRelay,0),
      zeroNewTargetRequests:countBuckets.filter(r=>!r.newOnRelay).length},countBuckets,replays,
    limits:'Prior coverage requires observed EOSE before client CLOSE, one filter, a non-full answer and closure before replay. Duplicate-only compares returned event IDs, not payload identity or in-engine acknowledgement. Empty live replay may still check a time gap. EOSE after CLOSE is unknown. No causal queue/slot decision is inferred.'};
}
