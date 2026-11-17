// Validate additive dependency errors through the exact shared TypeScript union.
import assert from 'node:assert/strict';
import test from 'node:test';
const message=error=>({t:'state',sub:'private',state:{
  phase:'live',relaysAsked:1,relaysAnswered:1,
  privateLists:{phase:error===undefined?'ready':'failed',pending:0,failed:error===undefined?0:1,
    ...(error===undefined?{}:{error})},
}});
test('indexed Failure.code accepts current declared errors',async()=>{
  const {validateReplies}=await import('./engine-contract.mjs');
  for(const code of ['signer-timeout','signer-refused','unsupported','offline','too-large'])
    assert.doesNotThrow(()=>validateReplies([message(code)]));
});
test('indexed Failure.code rejects undeclared and non-string errors',async()=>{
  const {validateReplies}=await import('./engine-contract.mjs');
  for(const code of ['not-a-declared-error',null,{},12])
    assert.throws(()=>validateReplies([message(code)]),/protocol shape mismatch \(payload redacted\)/);
});
test('optional dependency error remains optional',async()=>{
  const {validateReplies}=await import('./engine-contract.mjs');
  assert.doesNotThrow(()=>validateReplies([message(undefined)]));
  assert.doesNotThrow(()=>validateReplies([{t:'state',sub:'ordinary',
    state:{phase:'done',relaysAsked:1,relaysAnswered:1}}]));
});

test('Ready preserves old fields and accepts the optional fixed account failure',async()=>{
  const {validateReplies,protocolVersion}=await import('./engine-contract.mjs');
  const ready={t:'ready',version:protocolVersion,engine:'fixture'};
  assert.doesNotThrow(()=>validateReplies([ready,{...ready,accountError:{code:'internal'}}]));
});
test('Ready rejects non-contract account errors',async()=>{
  const {validateReplies,protocolVersion}=await import('./engine-contract.mjs');
  for(const accountError of [null,'internal',{}, {code:'offline'}, {code:12}])
    assert.throws(()=>validateReplies([{t:'ready',version:protocolVersion,engine:'fixture',accountError}]),/protocol shape mismatch \(payload redacted\)/);
});
