// Actual transactions plus explicitly virtual deadline/callback-order controls.
export async function storageCases(c,check) {
  // Ready precedes the ordinary DM marks transaction; attribute only this inspection's reads.
  const startup=await c.traceUntil(t=>t.marksReady);
  check('normal startup marks transaction finishes before inspection',startup.reads.some(read=>read.startupMarks),{reads:startup.reads});
  await c.control('fixture.reset');
  await c.send(0,{t:'storage.inspect',req:'base'});const base=await c.result('base');
  check('physical event rows and retained payloads remain separate',base.persistedEvents.phase==='ready'&&base.persistedEvents.count===3&&base.memory.events===0&&base.memory.eventPayloadBytes===0);
  check('origin estimate is marked approximate and is not event-cache bytes',base.origin.phase==='ready'&&base.origin.approximate===true&&base.origin.usage===700&&base.origin.quota===900);
  check('component callback times use one Worker monotonic domain',base.startedAt===base.memory.at&&base.startedAt<=base.persistedEvents.at&&base.startedAt<=base.origin.at&&base.finishedAt>=Math.max(base.persistedEvents.at,base.origin.at));
  const trace=await c.control('fixture.trace');
  check('inspection never reads private keys, archives or event payloads',trace.reads.length===1&&trace.reads[0].store==='events'&&trace.reads[0].method==='count',{reads:trace.reads});
  await c.send(0,{t:'stats',req:'original'});await c.until(ms=>ms.some(m=>m.t==='stats'&&m.req==='original'));
  const stats=(await c.all(0)).find(m=>m.t==='stats'&&m.req==='original').stats;
  check('existing Stats payload accounting is unchanged',stats.totals.eventsStored===base.memory.events&&stats.totals.cacheBytes===base.memory.eventPayloadBytes);
  for(const mode of ['failed','unsupported','invalid']){
    await c.control('fixture.mode',{estimate:mode,count:'ready'});await c.send(0,{t:'storage.inspect',req:mode});const report=await c.result(mode);
    check(mode+' origin observation keeps a valid exact count',report.persistedEvents.count===3&&report.origin.phase===(mode==='unsupported'?'unsupported':'failed')&&!('usage'in report.origin));
  }
  await c.control('fixture.mode',{estimate:'ready',count:'failed'});await c.send(0,{t:'storage.inspect',req:'count-failed'});const failed=await c.result('count-failed');
  check('failed count retains independently valid origin evidence',failed.persistedEvents.phase==='failed'&&failed.origin.phase==='ready');
  await c.control('fixture.mode',{count:'hold'});await c.send(0,{t:'storage.inspect',req:'count-timeout'});await c.traceUntil(t=>t.heldCounts===1);
  await c.control('fixture.advance',{ms:15001});const timed=await c.result('count-timeout');
  check('original deadline expires only unfinished components',timed.persistedEvents.phase==='timeout'&&timed.origin.phase==='ready');
  await c.control('fixture.count');await c.control('fixture.mode',{count:'ready',estimate:'hold'});
  await c.send(0,{t:'storage.inspect',req:'port-owner'});await c.traceUntil(t=>t.heldEstimates===1);
  await c.send(1,{t:'storage.close',req:'port-owner'});await c.control('fixture.estimate');await c.result('port-owner');
  check('wrong-port close cannot consume the originating request',!(await c.all(1)).some(m=>m.t==='storage'&&m.req==='port-owner'));
  await c.send(0,{t:'storage.inspect',req:'reuse'});await c.traceUntil(t=>t.heldEstimates===1);
  await c.send(0,{t:'storage.close',req:'reuse'});await c.control('fixture.mode',{estimate:'ready'});
  const after=(await c.all(0)).length;await c.send(0,{t:'storage.inspect',req:'reuse'});await c.control('fixture.estimate',{value:{usage:999,quota:999}});
  const reused=await c.result('reuse',0,after);
  check('a new request never adopts cancelled estimate bytes',reused.origin.phase==='ready'&&reused.origin.usage===700&&(await c.all(0)).filter(m=>m.t==='storage'&&m.req==='reuse').length===1);
  await c.control('fixture.mode',{estimate:'hold'});await c.send(0,{t:'storage.inspect',req:'hidden'});await c.traceUntil(t=>t.heldEstimates===1);
  const hint=pageHidden=>({t:'hint',hint:{pageHidden,visibleSubs:[],idle:false,saveData:false}});
  await c.send(0,hint(true));await c.send(0,{t:'storage.inspect',req:'hidden-admission'});await c.until(ms=>ms.some(m=>m.t==='result'&&m.req==='hidden-admission'));
  await c.control('fixture.mode',{estimate:'ready'});await c.control('fixture.estimate');await c.send(0,hint(false));
  await c.send(0,{t:'storage.inspect',req:'visible'});await c.result('visible');
  check('hidden owners cancel and cannot admit another read',(await c.all(0)).some(m=>m.t==='result'&&m.req==='hidden-admission'&&m.error?.code==='rejected')&&!(await c.all(0)).some(m=>m.t==='storage'&&m.req==='hidden'));
  await c.control('fixture.mode',{estimate:'hold'});await c.send(1,{t:'storage.inspect',req:'detached'});await c.traceUntil(t=>t.heldEstimates===1);
  await c.send(1,{t:'detach'});await c.control('fixture.mode',{estimate:'ready'});await c.control('fixture.estimate');
  await c.send(0,{t:'storage.inspect',req:'detach-barrier'});await c.result('detach-barrier');
  check('detached port never receives a late inspection',!(await c.all(1)).some(m=>m.t==='storage'&&m.req==='detached'));
  await c.control('fixture.mode',{estimate:'hold',count:'hold'});await c.send(0,{t:'storage.inspect',req:'stopped'});await c.traceUntil(t=>t.heldEstimates===1&&t.heldCounts===1);
  check('fixture attempted no network sockets',(await c.control('fixture.trace')).sockets===0);
  await c.control('fixture.stop');await c.page.waitForTimeout(50);
  check('explicit stop suppresses retained effect completions',!(await c.all(0)).some(m=>m.t==='storage'&&m.req==='stopped'));
}
