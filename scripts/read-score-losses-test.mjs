import test from 'node:test';
import assert from 'node:assert/strict';
import { auditLosses,matches } from './read-score-losses.mjs';
const event=(id,created_at)=>({id,pubkey:'a',kind:1,created_at,tags:[]});
test('query matching keeps time boundaries, author prefixes and tagged conjunctions exact',()=>{
  const e=event('target',10);
  assert.equal(matches(e,{authors:['a'],kinds:[1],since:10,until:10}),true);
  assert.equal(matches(e,{until:9}),false);assert.equal(matches(e,{'#p':['b']}),false);
});
test('a full newer request quota is named instead of turning an older control into a product miss',()=>{
  const target=event('target',5),newer=event('newer',10);
  const r=auditLosses({witness:['target'],events:[target],received:[newer],
    requests:[{index:0,filters:[{kinds:[1],limit:1}],received:['newer']}],
    stored:['newer'],verified:['newer'],obtained:[]});
  assert.equal(r.quotaLimited,true);assert.equal(r.missing[0].reason,'outside-all-observed-request-quotas');
});
test('unasked want and a matched unanswered relay remain different unknowns',()=>{
  const target=event('target',5);
  const common={witness:['target'],events:[target],received:[],stored:[],verified:[],obtained:[]};
  assert.equal(auditLosses({...common,requests:[]}).missing[0].reason,'not-requested-in-observed-wire-window');
  assert.match(auditLosses({...common,requests:[{index:0,filters:[{kinds:[1],limit:60}],received:[]}]}).missing[0].reason,/no-receipt/);
});
