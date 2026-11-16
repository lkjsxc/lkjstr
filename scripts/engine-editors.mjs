// Cross-page lock barrier, dirty-expiry recovery and real encrypted archive round trips.
import {validateReplies} from './engine-contract.mjs';
import {archiveDisk} from './engine-draft-client.mjs';
import {editorBoot,editorClient} from './engine-editor-client.mjs';
export async function privateEditorLocks({page:ownerPage,origin,check,kinds,before=false}) {
  const context=await ownerPage.context().browser().newContext();
  let c;
  try {
    await context.route('**/*',route => {
      if(route.request().url()===origin+'/editor-worker.js')
        return route.fulfill({contentType:'text/javascript',body:editorBoot});
      return new URL(route.request().url()).origin===origin?route.continue():route.abort();
    });
    const page=await context.newPage();await page.goto(origin);c=await editorClient(page);
    const a=await c.attach(),b=await c.attach(),outsider=await c.attach();
    const act=(port,action)=>{kinds?.add(action.a);return c.act(port,action);};
    check('editor fixture creates only a fresh local account',(await act(a,{a:'account.add',how:'create'})).ok);
    const account=(await c.messages())[a].filter(m=>m.t==='accounts').at(-1).active;
    const backup=await act(a,{a:'account.exportEncrypted',pubkey:account,password:'editor fixture',logN:16});
    check('editor fixture establishes encrypted local storage',
      (await act(a,{a:'account.importEncrypted',key:backup.encryptedKey,password:'editor fixture'})).ok);
    const register=(port,editor,dirty)=>act(port,{a:'dm.editor',as:account,editor,open:true,dirty});
    // The old protocol silently ignores unknown actions; do not turn that setup limitation into a timeout.
    const firstRegistration=before
      ? (await c.begin(a,{a:'dm.editor',as:account,editor:'page-a-editor',open:true,dirty:true}), {ok:false})
      : await register(a,'page-a-editor',true);
    if(!before)check('editor registration is acknowledged before input',firstRegistration.ok);
    const mark=(await c.messages())[a].length;
    const first=await c.begin(b,{a:'account.lock',pubkey:account});
    if(before) {
      await c.finish(b,first);
      check('another page cannot lock while an editor has unflushed text',
        !(await c.messages())[b].some(m=>m.t==='result'&&m.req===first&&m.ok));
      return;
    }
    const initial=await c.prepare(a,mark);
    await c.fence(b);
    check('another page lock waits for the private editor',
      !(await c.messages())[b].some(m=>m.t==='result'&&m.req===first));
    check('prepare closes new editor admission',
      !(await register(b,'late-editor',false)).ok);
    await c.send(outsider,{t:'dm.flushed',req:initial.req,ok:true});await c.fence(outsider);
    check('another port cannot acknowledge an editor flush',
      !(await c.messages())[b].some(m=>m.t==='result'&&m.req===first));
    await c.send(a,{t:'dm.flushed',req:initial.req,ok:true});
    check('a dirty editor cannot falsely certify a successful save',!(await c.finish(b,first)).ok);
    const afterFailed=(await c.messages())[a];
    check('failed preparation releases the editor and preserves unlocked authority',
      afterFailed.some(m=>m.t==='dm.flush'&&m.req===initial.req&&m.phase==='release')
      &&afterFailed.filter(m=>m.t==='accounts').at(-1).accounts.find(v=>v.author.pubkey===account).locked===false);
    const absent=await act(a,{a:'dm.draft.load',as:account,tab:'lock-draft'});
    const marker='private cross-page unsaved tail';
    const state={draft:{recipients:['22'.repeat(32)],text:marker},failed:[]};
    const mark2=(await c.messages())[a].length;
    const second=await c.begin(b,{a:'account.lock',pubkey:account});
    const request=await c.prepare(a,mark2);
    const saved=await act(a,{a:'dm.draft.save',as:account,tab:'lock-draft',state,expected:absent.dmDraftRevision});
    check('prepare permits the outstanding encrypted draft write',saved.ok);
    check('latest committed draft clears its dirty lease',(await register(a,'page-a-editor',false)).ok);
    await c.send(a,{t:'dm.flushed',req:request.req,ok:true});
    check('lock commits after the owning page saved and acknowledged',(await c.finish(b,second)).ok);
    await c.until(all=>all[a].some(m=>m.t==='dm.flush'&&m.req===request.req&&m.phase==='release'));
    const ordered=(await c.messages())[a];
    const release=ordered.findIndex(m=>m.t==='dm.flush'&&m.req===request.req&&m.phase==='release');
    check('locked authority precedes the editor release',
      ordered.slice(0,release).filter(m=>m.t==='accounts').at(-1).accounts.find(v=>v.author.pubkey===account).locked===true);
    check('owned local account unlocks',(await act(b,{a:'account.unlock',pubkey:account,password:'editor fixture'})).ok);
    check('cross-page saved tail survives the lock round trip',
      (await act(a,{a:'dm.draft.load',as:account,tab:'lock-draft'})).dmDraft?.draft.text===marker);
    const disk=await archiveDisk(page,[account],[marker]);
    check('cross-page lock never persists private text outside the encrypted archive',disk.privateTextAbsent);
    await register(a,'page-a-editor',false);await register(b,'page-b-editor',false);
    const at=(await c.messages())[a].length;
    const stale=await c.begin(b,{a:'account.lock',pubkey:account});
    const current=await c.prepare(a,at);
    await c.send(a,{t:'dm.flushed',req:request.req,ok:true});
    await c.send(b,{t:'dm.flushed',req:current.req,ok:true});await c.fence(a);
    check('a previous attempt cannot acknowledge the next lock',
      !(await c.messages())[b].some(m=>m.t==='result'&&m.req===stale));
    await c.send(a,{t:'dm.flushed',req:current.req,ok:false});
    check('one failed page prevents the lock even when another saved',!(await c.finish(b,stale)).ok);
    const timeoutAt=(await c.messages())[a].length;
    const timed=await c.begin(b,{a:'account.lock',pubkey:account});
    const timedRequest=await c.prepare(a,timeoutAt);
    await c.send(b,{t:'dm.flushed',req:timedRequest.req,ok:true});
    const started=Date.now();check('an unresponsive page fails the bounded prepare',!(await c.finish(b,timed)).ok);
    check('prepare timeout is bounded by fifteen seconds',Date.now()-started<17000);
    await register(a,'page-a-editor',true);
    await page.evaluate(()=>window.editorHost.postMessage({t:'test.clock',ms:181000}));
    await c.until(all=>all[a].some(m=>m.t==='reconnect')&&all[b].some(m=>m.t==='reconnect'));
    const resumed=await c.attach();
    check('expiry is not evidence that a dirty editor saved',
      !(await act(resumed,{a:'account.lock',pubkey:account})).ok);
    check('the same store reclaims its expired lease on a new port',
      (await register(resumed,'page-a-editor',true)).ok);
    await register(resumed,'page-a-editor',false);
    check('last-known-clean expired editor remains uncertain until its own resume',
      !(await act(resumed,{a:'account.lock',pubkey:account})).ok);
    const resumedB=await c.attach();
    await register(resumedB,'page-b-editor',false);
    const resumedAt=(await c.messages())[resumed].length;
    const resumedBAt=(await c.messages())[resumedB].length;
    const final=await c.begin(resumed,{a:'account.lock',pubkey:account});
    const finalRequest=await c.prepare(resumed,resumedAt);
    check('all pages hold before sequential save grants',
      (await c.messages())[resumedB].slice(resumedBAt).some(m=>m.t==='dm.flush'&&m.phase==='hold'&&m.req===finalRequest.req)
      &&!(await c.messages())[resumedB].slice(resumedBAt).some(m=>m.t==='dm.flush'&&m.phase==='prepare'));
    await c.send(resumed,{t:'dm.flushed',req:finalRequest.req,ok:true});
    const nextPage=await c.prepare(resumedB,resumedBAt);
    await c.send(resumedB,{t:'dm.flushed',req:nextPage.req,ok:true});
    check('resumed saved editors permit the next lock',(await c.finish(resumed,final)).ok);
    for(const messages of await c.messages())validateReplies(messages);
  } finally {
    try {await c?.close();} finally {await context.close();}
  }
}
