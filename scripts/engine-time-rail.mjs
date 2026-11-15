// Protocol 5 conformance: exact cached counts and ordinal seeks through the existing window input.
export async function timeRail({page,send,wait,check,note,signer,lines,fake}) {
  const sign=async(at,content)=>{
    signer.stdin.write(`${JSON.stringify({pubkey:note.pubkey,kind:1,created_at:at,content,tags:[]})}\n`);
    return JSON.parse((await lines.next()).value);
  };
  const events=[];
  for(let i=0;i<90;i++)events.push(await sign(i===0?0:i===1?4070908800:Date.UTC(2025-Math.floor(i/24),i%12,15)/1000,`time-rail-conformance ${i}`));
  for(const event of events)fake.add(event);
  const sub='time-rail';
  await send({t:'open',sub,query:{source:'search',text:'time-rail-conformance'}});
  await send({t:'window',sub,anchor:'top',before:0,after:2});
  await send({t:'hint',hint:{visibleSubs:[sub],pageHidden:false,idle:false,saveData:false}});
  await wait(sub=>window.messages.some(m=>m.t==='timeline'&&m.sub===sub&&m.timeline.supported&&m.timeline.months.reduce((s,b)=>s+b.count,0)===90),sub);
  let data=await page.evaluate(sub=>window.messages.filter(m=>m.t==='timeline'&&m.sub===sub).at(-1).timeline,sub);
  check('time rail counts all 90 matches outside its bounded window',data.months.reduce((s,b)=>s+b.count,0)===90&&data.positions.length>0&&data.positions.length<=2);
  check('time rail clamps future notes to current month and keeps epoch zero',new Date(data.months[0].at).getUTCFullYear()===new Date().getUTCFullYear()&&data.months.at(-1).at===0);

  await send({t:'window',sub,anchor:{month:0,offset:0},before:0,after:60});
  await wait(sub=>window.messages.some(m=>m.t==='rows'&&m.sub===sub&&m.rows[0]?.at===0),sub);
  check('time rail seeks outside loaded rows to timestamp zero',true);
  const tied=events.filter(e=>e.created_at===events[3].created_at).sort((a,b)=>b.id.localeCompare(a.id));
  const firstMonth=Date.UTC(new Date(tied[0].created_at*1000).getUTCFullYear(),new Date(tied[0].created_at*1000).getUTCMonth());
  await send({t:'window',sub,anchor:{month:firstMonth,offset:0},before:0,after:1});
  await wait(({sub,key})=>window.messages.some(m=>m.t==='rows'&&m.sub===sub&&m.rows[0]?.key===key),{sub,key:tied[0].id});
  check('time rail seek preserves timestamp and id order',true);
  const next=await sign(Math.floor(Date.now()/1000),'time-rail-conformance arrival');fake.add(next);
  await wait(sub=>window.messages.some(m=>m.t==='timeline'&&m.sub===sub&&m.timeline.months.reduce((s,b)=>s+b.count,0)===91),sub);
  check('time rail resends changed exact counts after live arrival',true);
  await send({t:'close',sub});
}
