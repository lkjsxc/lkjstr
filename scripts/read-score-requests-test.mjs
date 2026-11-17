import test from 'node:test';
import assert from 'node:assert/strict';
import { auditRequests } from './read-score-requests.mjs';
test('same-set replay ignores order but preserves time, limits and relay identity',()=>{
  const filter={kinds:[1,6,7,9735],'#e':['b','a'],limit:200};
  const req=(index,relay,filters,at,closedAt)=>({index,relay,filters,at,closedAt});
  const rows=[req(0,'wss://a',[filter],0,10),
    req(1,'wss://a',[{...filter,'#e':['a','b']}],5,20),
    req(2,'wss://a',[filter],25,30),
    req(3,'wss://a',[{...filter,since:1}],31,40),
    req(4,'wss://b',[filter],0,10)];
  const r=auditRequests(rows);
  assert.equal(r.exactSameRelayReplay,1);assert.equal(r.sameSetSameRelayReplay,2);
  assert.equal(r.orderOnlySameRelayReplay,1);assert.equal(r.overlappingSameSetRequests,1);
  assert.equal(r.families.counts.requests,5);assert.equal(r.families.counts.uniqueTargets,2);
});

test('temporal coverage never credits EOSE after CLOSE or a full answer', async()=>{
  const { auditTimeline }=await import('./read-score-temporal.mjs');
  const filter={kinds:[1],authors:['a'],limit:2};
  const row=(index,at,close,eose,received)=>({index,at,closedAt:close,eoseAt:eose,received,relay:'wss://a',filters:[filter]});
  const result=auditTimeline([row(0,0,5,6,['a']),row(1,10,20,15,['a']),
    row(2,30,40,35,['a']),row(3,50,60,55,[]),row(4,70,80,75,['a','b']),row(5,90,100,95,['a','b'])]);
  assert.equal(result.counts.priorCoverageUnknown,1);
  assert.equal(result.counts.closedEoseDuplicateOnly,1);
  assert.equal(result.counts.closedEoseEmptyReplay,1);
  assert.equal(result.replays.at(-1).closedEoseUntruncated,false);
});
