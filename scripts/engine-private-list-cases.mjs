import { assertOwnership } from '../web/tests/signer-ownership-fixture.ts';
// Concrete private projection and lifetime assertions against the compiled Worker.
const privateWord='private-list-fixture';
const contains=(rows,text)=>JSON.stringify(rows).includes(text);
export async function extensionListCases(c,fixture,check){
  await c.open('old','mutes',true,false);await c.barrier();await c.page.waitForTimeout(180);
  check('old query never opts into an external private decrypt',c.crypts(await c.all()).length===0);
  await c.open('m','mutes',false,true);await c.barrier();await c.page.waitForTimeout(180);
  check('initial hidden list cannot prompt between open and hint',c.crypts(await c.all()).length===0);
  await c.hint(['m']);
  // Keep the signer unanswered while waiting for the independent relay completion.
  let all=await c.until(ms=>c.crypts(ms).length===1&&c.status(ms,'m')!==undefined);
  const old=c.crypts(all)[0];c.handled.add(old.req);
  assertOwnership('private-list',old,{req:old.req,contextEvent:fixture.first.events.find(e=>e.kind===10000).id,runtime:true});
  check('native private-list ownership fixture matches Worker',true);
  check('private-list crypto carries exact owned view/event context',
    old.context.sub==='m'&&old.peer===c.pubkey&&old.context.event===fixture.first.events.find(e=>e.kind===10000).id);
  check('relay/cache completion does not claim private work finished',c.status(all,'m')?.phase==='loading');
  await c.hint([]);
  const retired=await c.until(ms=>ms.some(m=>m.t==='crypt.cancel'&&m.req===old.req));
  assertOwnership('private-list-cancel',retired.find(m=>m.t==='crypt.cancel'&&m.req===old.req),{req:old.req});
  check('native private-list retirement fixture matches Worker',true);
  await c.send({t:'crypted',req:old.req,value:'[["word","stale-private-marker"]]'});
  await c.hint(['m']);
  all=await c.until(ms=>c.crypts(ms).length===2);
  const current=c.crypts(all)[1];c.handled.add(current.req);
  check('hide/reopen uses a fresh correlation and rejects late plaintext',
    current.req!==old.req&&!contains(c.rows(all,'m'),'stale-private-marker'));
  await c.send({t:'crypted',req:current.req,error:'signer-refused'});
  await c.until(ms=>c.status(ms,'m')?.error==='signer-refused');
  await c.open('b','bookmarks');await c.barrier();await c.page.waitForTimeout(180);
  check('first list refusal pauses the account instead of prompting for its next list',
    c.crypts(await c.all()).length===2);
  check('list refusal preserves available public entries',
    contains(c.rows(await c.all(),'m'),'public-list-fixture'));
  check('explicit lists.retry is accepted',(await c.act({a:'lists.retry',as:c.pubkey})).ok);
}
export async function commonListCases(c,fixture,fake,kind,check){
  if(kind==='local'){
    await c.until(ms=>c.account(ms)?.privateLists?.phase==='ready'&&c.account(ms)?.unread===0);
    check('local saved-account unread applies private mutes without an open feed',true);
    await c.act({a:'account.add',how:'create'});
    check('another active account preserves the saved local mute policy',c.account(await c.all())?.unread===0);
    await c.act({a:'account.use',pubkey:c.pubkey});
  } else if(kind==='remote') {
    await c.until(ms=>c.account(ms)?.privateLists?.phase==='unknown');
    check('background bunker mute dependency is unknown without an external prompt',
      !fixture.calls.some(m=>m.method.endsWith('_decrypt')));
  }

  await c.open('m');await c.open('b','bookmarks');await c.open('p','list');
  let all=await c.until(ms=>contains(c.rows(ms,'m'),privateWord)
    &&contains(c.rows(ms,'b'),fixture.first.note)
    &&contains(c.rows(ms,'p'),fixture.first.peer)
    &&['m','b','p'].every(s=>c.status(ms,s)?.phase==='ready'),true);
  await c.until(ms=>c.account(ms)?.privateLists?.phase==='ready'&&c.account(ms)?.unread===0,true);
  check(kind+' reads authenticated44 mutes and bookmarks plus historical04 named members',true);
  if(kind==='extension')check('extension selects historical read-only nip04.decrypt',
    c.crypts(all).some(m=>m.operation==='nip04.decrypt')&&!c.crypts(all).some(m=>m.operation.endsWith('encrypt')));
  if(kind==='remote')check('bunker uses both documented read-only decrypt methods',
    fixture.calls.some(m=>m.method==='nip44_decrypt')&&fixture.calls.some(m=>m.method==='nip04_decrypt'));
  const count=kind==='extension'?c.crypts(all).length:fixture.calls.filter(m=>m.method.endsWith('_decrypt')).length;
  await c.send({t:'open',sub:'public',query:{source:'relay',relay:c.relay}});
  await c.send({t:'window',sub:'public',anchor:'top',before:0,after:50});
  await c.until(ms=>ms.some(m=>m.t==='rows'&&m.sub==='public'));
  await c.barrier();
  const note=await fixture.call({pubkey:c.pubkey,created_at:fixture.first.at+1,kind:1,tags:[],content:'new public fixture'});
  c.probe.publicNote=note.id;c.probe.publicAt=note.created_at;
  fake.add(note);
  await c.until(ms=>contains(c.rows(ms,'public'),note.id),true);await c.barrier();await c.page.waitForTimeout(180);
  const later=await c.all();
  check(kind+' does not repeat private crypto after an unrelated public Store insertion',
    (kind==='extension'?c.crypts(later).length:fixture.calls.filter(m=>m.method.endsWith('_decrypt')).length)===count);
  const stored=await c.page.evaluate(async()=>{
    const db=await new Promise((ok,bad)=>{const r=indexedDB.open('lkjstr-wasm');r.onsuccess=()=>ok(r.result);r.onerror=bad;});
    try{return await new Promise((ok,bad)=>{const r=db.transaction('events').objectStore('events').getAll();
      r.onsuccess=()=>ok(r.result.map(e=>e.raw));r.onerror=bad;});}finally{db.close();}
  });
  check(kind+' keeps private list plaintext out of persisted public event records',
    !JSON.stringify(stored).includes(privateWord));
  if(kind==='local'){
    check('local private lists never invoke an external signer',c.crypts(all).length===0);
    const locked=await c.act({a:'account.lock',pubkey:c.pubkey});
    check('successful lock removes private projection before its acknowledgement',
      locked.ok&&!contains(c.rows(await c.all(),'m'),privateWord));
    check('local unlock succeeds',(await c.act({a:'account.unlock',pubkey:c.pubkey,password:fixture.first.password})).ok);
    await c.until(ms=>contains(c.rows(ms,'m'),privateWord)&&c.status(ms,'m')?.phase==='ready');
    check('unlock reuses cached ciphertext without requiring a Store revision',true);
  }
}
export async function removedListCase(c,fixture,fake,check){
  const count=c.crypts(await c.all()).length;
  // A fresh address owns a real lookup; an already-finished mute lookup is finite.
  const event=await fixture.call({list:{kind:30000,at:fixture.first.at+2,
    tags:[['d','remove-flight']],entries:[['p',fixture.first.peer]]}});
  fake.add(event);
  await c.send({t:'open',sub:'remove-flight',visible:true,query:{source:'list',
    account:c.pubkey,privateLists:true,tag:'30000:'+c.pubkey+':remove-flight'}});
  const all=await c.until(ms=>c.crypts(ms).length>count);
  const pending=c.crypts(all).at(-1);c.handled.add(pending.req);
  check('removal fixture owns the fresh named-list decrypt',
    pending.context.sub==='remove-flight'&&pending.context.event===event.id);
  const removed=await c.act({a:'account.remove',pubkey:c.pubkey});
  await c.send({t:'crypted',req:pending.req,value:JSON.stringify([['p',fixture.first.peer]])});
  await c.open('removed');await c.barrier();
  const later=await c.all();
  check('account removal consumes an in-flight list reply before any later projection',
    removed.ok&&!contains(c.rows(later,'m'),privateWord)
    &&!contains(c.rows(later,'removed'),privateWord)&&c.rows(later,'remove-flight').length===0);
}
