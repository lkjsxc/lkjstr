// Exact interleavings use exported harness-only scheduling, never production controls.
import { authorizationZapDeadline } from './engine-bunker-auth-zap.mjs';
async function queued(c, expected) {
  const end=Date.now()+5000;
  while(Date.now()<end) {
    if((await c.control('fixture.queued')).ok===expected)return;
    await c.page.waitForTimeout(20);
  }
  throw Error('owned public-sign queue did not reach its expected state');
}
export async function authorizationBoundaries({c,fixture,fake,origin,check}) {
  const account=fixture.first.pubkey,relay=origin.replace('http:','ws:');
  const count=async()=> (await c.all(0)).filter(m=>m.t==='signer.auth').length;
  const held=()=>fixture.pending().at(-1);
  const add={a:'account.add',how:'key',key:'bunker://'+account+'?relay='+encodeURIComponent(relay+'/bunker')};
  fixture.configure(origin,[]);
  await c.send(0,{t:'relays',relays:[{url:relay,read:true,write:true,search:true}]});
  check('queued-authority fixture opens its fresh owned bunker',(await c.act(add)).ok);
  fixture.configure(origin,['sign_event']);
  check('one public-sign queue barrier arms', (await c.control('fixture.hold',{account})).ok);
  check('the harness cannot arm a second queued barrier',!(await c.control('fixture.hold',{account})).ok);
  const req=await c.begin({a:'publish',as:account,what:{k:'note',draft:{text:'stale queued auth fixture'}}});
  await queued(c,true);
  const calls=fixture.calls.length,before=await count();
  check('same saved Remote replacement renews only its normal authority generation',
    (await c.control('fixture.renew',{account})).ok);
  check('held action is released before its original deadline',(await c.control('fixture.release')).ok);
  const observed=await c.until(ms=>ms.some(m=>(m.t==='result'&&m.req===req)||(m.t==='signer.auth'&&m.actionReq===req)));
  const challenge=observed.find(m=>m.t==='signer.auth'&&m.actionReq===req);
  // A before package must be cleaned up without approving its stale operation.
  if(challenge)await c.send(0,{t:'signer.auth.cancel',id:challenge.id});
  const stale=await c.result(req);
  check('captured old generation cannot open a remote RPC or expose authorization',
    !challenge&&fixture.calls.length===calls&&await count()===before&&!stale.ok);
  check('the stale queued publication never reaches the owned relay',
    !fake.published.some(e=>e.content==='stale queued auth fixture'));
  const currentBefore=await count();
  const current=await c.begin({a:'publish',as:account,what:{k:'note',draft:{text:'current queued auth fixture'}}});
  const live=await c.challenge(currentBefore);
  check('a newly dispatched current generation still owns a fresh challenge',live.account===account&&live.actionReq===current);
  fixture.release(held());
  check('current generation signing succeeds after queue release',(await c.result(current)).ok);
  await authorizationZapDeadline({c,fixture,fake,origin,account,check});
  const beforeDetach=fixture.calls.length;
  check('detach control arms a fresh bounded barrier',(await c.control('fixture.hold',{account})).ok);
  await c.begin({a:'publish',as:account,what:{k:'note',draft:{text:'detached queued auth fixture'}}},1);
  await queued(c,true);await c.send(1,{t:'detach'});await queued(c,false);
  check('client detach releases its queued future without starting remote work',fixture.calls.length===beforeDetach);
  const beforeStop=fixture.calls.length;
  check('stop control arms a fresh bounded barrier',(await c.control('fixture.hold',{account})).ok);
  await c.begin({a:'publish',as:account,what:{k:'note',draft:{text:'stopped queued auth fixture'}}});
  await queued(c,true);await c.control('fixture.stop');await queued(c,false);
  check('permanent Host stop releases the queue without reviving remote work',fixture.calls.length===beforeStop);
}
