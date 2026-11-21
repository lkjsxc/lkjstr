// The signed-out Worker seeds its cache and discovers a follow list over loopback.
export async function absoluteTimeWindow({page, send, wait, check, note, signer, lines, fake, origin}) {
  const request = async (fields) => {
    signer.stdin.write(`${JSON.stringify(fields)}\n`);
    return JSON.parse((await lines.next()).value);
  };
  const owner = await request({fixtureActor:true});
  const outsider = await request({fixtureActor:true});
  const at = 1690012300;
  const sign = (pubkey, kind, offset, content, tags=[]) =>
    request({pubkey,kind,tags,created_at:at+offset,content:`absolute-cache-fixture ${content}`});
  const notes = [];
  for (const [offset, title] of [[-3,'earlier'],[-1,'reposted'],[0,'tie-a'],[0,'tie-b'],[1,'later'],[3,'farther']]) {
    notes.push(await sign(note.pubkey, 1, offset, title));
  }
  const repost = await sign(note.pubkey, 6, 2, 'scoped repost', [['e',notes[1].id]]);
  const unrelated = await sign(outsider.pubkey, 6, 4, 'unrelated repost', [['e',notes[1].id]]);
  for (const event of [...notes,repost,unrelated]) fake.add(event);
  const seed = 'absolute-cache-seed';
  const sub = 'absolute-cache-window';
  const hint = (visibleSubs) => send({t:'hint',hint:{visibleSubs,pageHidden:false,idle:false,saveData:false}});
  const seek = (target, before, after) => send({t:'window',sub,anchor:{at:target},before,after});
  const report = () => page.evaluate(sub=>window.messages.findLast(m=>m.t==='timeWindow'&&m.sub===sub),sub);
  const rows = () => page.evaluate(sub=>window.messages.findLast(m=>m.t==='rows'&&m.sub===sub),sub);
  const waitReport = (at) => wait(({sub,at})=>window.messages.some(m=>m.t==='timeWindow'&&m.sub===sub&&m.at===at),{sub,at});
  await send({t:'relays',relays:[{url:origin.replace('http:','ws:'),read:true,write:true,search:true}]});
  await send({t:'open',sub:seed,query:{source:'search',text:'absolute-cache-fixture'}});
  await hint([seed]);
  await wait(({seed,ids,reposted,at})=>{
    const rows=window.messages.filter(m=>m.sub===seed)
      .flatMap(m=>m.rows??m.ops?.flatMap(op=>op.rows??(op.row?[op.row]:[]))??[]);
    return ids.every(id=>rows.some(row=>row.key===id))&&
      rows.some(row=>row.key===reposted&&row.repostedBy?.at===at);
  },{seed,ids:notes.map(event=>event.id),reposted:notes[1].id,at:unrelated.created_at*1000});
  await send({t:'close',sub:seed});
  await send({t:'open',sub,visible:false,query:{source:'their-home',pubkey:owner.pubkey}});
  await seek(at*1000+999,1,3);
  await hint([sub]);
  await waitReport(at*1000+999);
  const signedOut = await page.evaluate(()=>window.messages.findLast(m=>m.t==='accounts')?.active===undefined);
  const initial = await report();
  check('signed-out absolute window starts unknown without a verified follow list',
    signedOut&&initial.followList?.state==='unknown'&&!initial.key);

  const list = await request({pubkey:owner.pubkey,kind:3,tags:[['p',note.pubkey]],created_at:at+200,content:''});
  fake.add(list);
  const sorted = [notes[4],...notes.slice(2,4).sort((a,b)=>b.id.localeCompare(a.id)),notes[0]];
  await wait(({sub,id})=>window.messages.some(m=>m.t==='timeWindow'&&m.sub===sub&&m.followList?.id===id),{sub,id:list.id});
  const observed = await report();
  check('absolute window names the actual follow list and leaves both relay edges unresolved',
    observed.key===sorted[1].id&&observed.at===at*1000+999&&observed.newer==='cache-only'&&observed.older==='cache-only'&&observed.followList.at===list.created_at*1000);

  await seek(at*1000,1,3);
  await waitReport(at*1000);
  const window = await rows();
  check('absolute window selects nearest rows on both sides in timestamp and id order',
    window.rows.map(r=>r.key).join(',')===sorted.map(e=>e.id).join(',')&&!window.atTop&&!window.atBottom);

  await seek(repost.created_at*1000,0,1);
  await waitReport(repost.created_at*1000);
  const seated = (await rows()).rows[0];
  check('signed-out Their Home seats the scoped rendered repost time',
    (await report()).key===seated?.key&&seated.key===notes[1].id&&
    seated.repostedBy?.at===repost.created_at*1000&&seated.at===notes[1].created_at*1000);
  check('absolute cache window retains no followee note history filter',
    !fake.activeFilters().some(f=>f.authors?.includes(note.pubkey)&&f.kinds?.includes(1)));
  await send({t:'close',sub});
}
