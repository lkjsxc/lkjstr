// Diagnose a witness miss without turning finite relay caps into a completeness claim.
export function matches(event, f) {
  if(f.ids?.length&&!f.ids.some(id=>event.id.startsWith(id)))return false;
  if(f.authors?.length&&!f.authors.some(p=>event.pubkey.startsWith(p)))return false;
  if(f.kinds?.length&&!f.kinds.includes(event.kind))return false;
  if(f.since!==undefined&&event.created_at<f.since)return false;
  if(f.until!==undefined&&event.created_at>f.until)return false;
  for(const [tag,values] of Object.entries(f))if(tag.startsWith('#')&&
    !event.tags?.some(t=>t[0]===tag.slice(1)&&values.includes(t[1])))return false;
  return !f.search; // Native semantic search cannot be inferred from wire strings here.
}
const before = (a,b)=>a.created_at>b.created_at||(a.created_at===b.created_at&&a.id<b.id);
export function auditLosses({witness,events,received,requests,stored,verified,obtained}) {
  const bodies=new Map([...events,...received].map(e=>[e.id,e]));
  const raw=new Set(received.map(e=>e.id)),saved=new Set(stored),valid=new Set(verified),found=new Set(obtained);
  const misses=[];
  for(const id of witness){
    if(found.has(id))continue;
    const event=bodies.get(id);
    const matching=requests.flatMap(request=>request.filters.filter(f=>event&&matches(event,f)).map(filter=>({request,filter})));
    const quota=matching.filter(({request,filter})=>{
      const returned=request.received?.map(id=>bodies.get(id)).filter(e=>e&&matches(e,filter))??[];
      return Number.isFinite(filter.limit)&&returned.filter(e=>before(e,event)).length>=filter.limit;
    });
    const reason=raw.has(id)?(!valid.has(id)?'received-unverified':!saved.has(id)?'received-not-in-product-store':'received-policy-excluded')
      :matching.length===0?'not-requested-in-observed-wire-window'
      :quota.length===matching.length?'outside-all-observed-request-quotas'
      :'matched-request-but-no-receipt; relay-completeness-unknown';
    misses.push({id,createdAt:event?.created_at,reason,matchingRequests:matching.map(x=>x.request.index),
      quotaExcludedRequests:quota.map(x=>x.request.index)});
  }
  return {scope:'Diagnostic only; do not silently alter or inflate the frozen recall denominator',
    missing:misses,counts:Object.fromEntries([...new Set(misses.map(x=>x.reason))].map(reason=>[reason,misses.filter(x=>x.reason===reason).length])),
    quotaLimited:misses.some(x=>x.reason==='outside-all-observed-request-quotas'),
    comparability:misses.some(x=>x.reason==='outside-all-observed-request-quotas')?'requested quotas do not cover frozen witnesses; no public recall improvement claim':'bounded witness coverage only'};
}
