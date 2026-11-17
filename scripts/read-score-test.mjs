import assert from 'node:assert/strict';
import test from 'node:test';
import { createReadScore } from './read-score-model.mjs';
import { compareScore,stopRule } from './read-score-compare.mjs';
const id = 'a'.repeat(64), old = 'b'.repeat(64), other = 'c'.repeat(64);
function fixture(options) {
  const s = createReadScore(options); s.start();
  const send = (method,p)=>s.receive({method:'Network.'+method,params:{requestId:'s',...p},sessionId:'worker',observedAt:1});
  send('webSocketCreated',{url:'wss://fixture.test/'});
  const frame = (sent,value)=>send(sent?'webSocketFrameSent':'webSocketFrameReceived',{response:{opcode:1,payloadData:JSON.stringify(value)}});
  frame(true,['REQ','one',{kinds:[1]}]);
  return {s,frame};
}
test('wire duplicates remain counted on the same and different subscriptions',()=>{
  const {s,frame}=fixture({held:[old]});
  for (const value of [id,id,old,other]) frame(false,['EVENT','one',{id:value,kind:1}]);
  frame(false,['EOSE','one']);
  frame(true,['REQ','two',{kinds:[1]}]); frame(false,['EVENT','two',{id,kind:1}]); frame(false,['EOSE','two']);
  const r=s.finish({verified:[id,old,other],wanted:[id,old],witness:[id,old],witnessComplete:true});
  assert.equal(r.metrics.wireEvents,5); assert.equal(r.metrics.duplicateWireEvents,2);
  assert.equal(r.metrics.wantedNew,1); assert.equal(r.metrics.heldWireEvents,1);
  assert.equal(r.metrics.unwantedWireEvents,1); assert.equal(r.metrics.requests,2);
  assert.equal(r.recall.ratio,1); assert.equal(r.complete,true);
});
test('unverified body cannot borrow witness credit; bounds remain unknown',()=>{
  const {s,frame}=fixture({capEvents:1});
  frame(false,['EVENT','one',{id,kind:1}]); frame(false,['EVENT','one',{id:other,kind:1}]);
  const r=s.finish({verified:[id],wanted:[id,other],witness:[id,other]});
  assert.equal(r.metrics.wireEvents,2); assert.equal(r.recall.ratio,.5);
  assert.equal(r.complete,false); assert.ok(r.unknown.includes('event-body-bound'));
});
test('empty completed requests differ from pending work and zero denominators',()=>{
  const {s,frame}=fixture(); frame(false,['EOSE','one']); frame(true,['REQ','two',{kinds:[1]}]);
  const r=s.finish(); assert.equal(r.metrics.wastedRequests,1); assert.equal(r.metrics.unansweredRequests,1);
  assert.equal(r.metrics.requestsPerWantedNew,null); assert.equal(r.recall.ratio,null);
});
const score = {workloadHash:'w',witnessHash:'v',initialStoreHash:'s',mode:'native',
  complete:true,recall:{ratio:1},firstScreenMs:100,metrics:{requestsPerWantedNew:2,
    connectionsPerWantedNew:1,duplicatesPerWantedNew:1,bytesPerWantedNew:100}};
test('keep requires comparable recall, no slower first screen and lower measured cost',()=>{
  const good=structuredClone(score); good.metrics.duplicatesPerWantedNew=.5;
  assert.equal(compareScore(score,good).keep,true);
  for (const bad of [{...good,firstScreenMs:101},{...good,recall:{ratio:.99}},{...good,witnessHash:'other'},{...good,complete:undefined}]) {
    assert.equal(compareScore(score,bad).keep,false);
  }
});
test('three actual comparable attempts without two percent movement trigger stop',()=>{
  const same=compareScore(score,score);
  assert.equal(stopRule([same,same,same]).stop,false);
  const attempts=[1,2,3].map(n=>compareScore({...score,productSourceHash:'base'},
    {...score,productSourceHash:'candidate-'+n},'commit-'+n));
  assert.equal(stopRule(attempts.slice(0,2)).stop,false);assert.equal(stopRule(attempts).stop,true);
  assert.equal(stopRule([attempts[0],attempts[0],attempts[0]]).stop,false);
  const change=structuredClone(score);change.metrics.bytesPerWantedNew=97;change.productSourceHash='new';
  assert.equal(stopRule([...attempts.slice(0,2),compareScore({...score,productSourceHash:'base'},change,'new-commit')]).stop,false);
  assert.equal(stopRule([...attempts.slice(0,2),{...attempts[2],comparable:false}]).stop,false);
});

test('event identity ignores object key order and preserves changed native fields',()=>{
  const {s,frame}=fixture();
  frame(false,['EVENT','one',{id,kind:1,content:'one'}]);
  frame(false,['EVENT','one',{content:'one',kind:1,id}]);
  frame(false,['EVENT','one',{id,kind:1,content:'different'}]);
  const r=s.finish();
  assert.equal(r.metrics.wireEvents,3);assert.equal(r.metrics.duplicateWireEvents,1);
  assert.equal(r.deliveries.length,3);assert.equal(r.socketHistory.length,1);
  assert.equal(r.requests[0].socket,'worker:s');
});
