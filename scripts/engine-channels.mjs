import { protocolVersion } from './engine-contract.mjs';
// NIP-28 acceptance against a fresh loopback route; no public relay traffic.
export async function channels({page,send,wait,check,note,signer,lines,fake,origin,act,kinds,bunker}) {
  check('ready advertises the current channels contract',await page.evaluate(version=>window.messages.some(m=>m.t==='ready'&&m.version===version),protocolVersion));
  const route=`${origin.replace('http:','ws:')}/channels`;
  check('channel fixture selects its loopback owner relay',(await act({a:'relays.save',as:note.pubkey,relays:[{url:route,read:true,write:true}]},true)).ok);
  await page.evaluate(()=>{
    window.channelRows={};window.channelStates={};window.channelFresh={};
    const previous=window.worker.onmessage;
    window.worker.onmessage=e=>{
      previous(e);const m=e.data;if(!m.sub?.startsWith('ch-'))return;
      if(m.t==='rows')window.channelRows[m.sub]=m.rows.slice();
      if(m.t==='state')window.channelStates[m.sub]=m.state;
      if(m.t==='fresh')window.channelFresh[m.sub]=m.count;
      if(m.t==='patch')for(const o of m.ops){
        const rows=window.channelRows[m.sub]??=[];
        if(o.op==='remove'){const at=rows.findIndex(r=>r.key===o.key);if(at>=0)rows.splice(at,1);}
        if(o.op==='update'){const at=rows.findIndex(r=>r.key===o.row.key);if(at>=0)rows[at]=o.row;}
        if(o.op==='insert'){const at=o.before===null?rows.length:rows.findIndex(r=>r.key===o.before);rows.splice(at<0?rows.length:at,0,...o.rows);}
      }
    };
  });
  const sign=async(kind,created_at,content,tags=[])=>{
    signer.stdin.write(`${JSON.stringify({pubkey:note.pubkey,kind,created_at,content,tags})}\n`);
    return JSON.parse((await lines.next()).value);
  };
  const root=id=>[['e',id,route,'root']];
  const open=async(sub,query)=>{
    await send({t:'open',sub,query});
    await wait(s=>window.channelRows[s]!==undefined,sub);
  };
  const c=[];for(let i=0;i<4;i++){const e=await sign(40,1700300000+i,JSON.stringify({name:`Room ${i}`,about:'channel garden',relays:[route]}));c.push(e);fake.add(e);}
  fake.add(await sign(10005,Math.floor(Date.now()/1000)+10,'',c.slice(0,3).map(e=>['e',e.id])));
  const earlyJoin=await act({a:'channel.join',as:note.pubkey,id:c[0].id,on:true},true);
  check('early channel join fetches its owner list without an open channel view',earlyJoin.ok&&fake.published.some(e=>e.kind===10005&&e.tags.filter(t=>t[0]==='e').map(t=>t[1]).join()===c.slice(0,3).map(e=>e.id).join()));
  await open('ch-list',{source:'channels',account:note.pubkey});
  await send({t:'hint',hint:{visibleSubs:['ch-list'],pageHidden:false,idle:false,saveData:false}});
  await wait(ids=>window.channelRows['ch-list']?.slice(0,3).map(r=>r.id).join()===ids.join(),c.slice(0,3).map(e=>e.id));
  check('channels NIP-51 list keeps all three channels in list order',true);
  await wait(()=>window.channelStates['ch-list']?.phase==='done');
  check('channel list becomes finite done after relay answers',true);
  await open('ch-word',{source:'channels',text:'ROOM 1 GARDEN'});
  await wait(id=>window.channelRows['ch-word']?.length===1&&window.channelRows['ch-word'][0].id===id,c[1].id);
  check('channel names and about match every word ignoring case',true);
  const ref=await page.evaluate(()=>window.channelRows['ch-list'][0].bech32);
  await open('ch-ref',{source:'channels',text:ref});
  await wait(id=>window.channelRows['ch-ref']?.length===1&&window.channelRows['ch-ref'][0].id===id,c[0].id);
  check('pasted channel nevent resolves exactly one channel',true);
  await open('ch-not-channel',{source:'channels',text:note.id});
  await wait(()=>window.channelRows['ch-not-channel']?.length===0);
  check('known nonchannel reference yields no channel row',true);
  for(const sub of ['ch-word','ch-ref','ch-not-channel'])await send({t:'close',sub});
  const history=[];
  for(let i=0;i<230;i++)history.push(await sign(42,1700400000+Math.floor(i/3),`Channel history ${i}`,root(c[0].id)));
  for(const e of history)fake.add(e);
  await open('ch-room',{source:'channel',id:c[0].id,account:note.pubkey});
  await send({t:'hint',hint:{visibleSubs:['ch-list','ch-room'],pageHidden:false,idle:false,saveData:false}});
  await wait(()=>window.channelRows['ch-room']?.length>=50&&window.channelRows['ch-room'][0].kind==='channel');
  await wait(()=>['live','done'].includes(window.channelStates['ch-room']?.phase));
  check('channel opens with stable header and newest messages',await page.evaluate(()=>window.channelRows['ch-room'].slice(1).every(r=>r.channel?.name==='Room 0'&&!r.replyTo)));
  const found=new Set();let bottom=false;let unique=true;
  for(let pageNo=0;pageNo<12;pageNo++){
    const rows=await page.evaluate(()=>window.channelRows['ch-room'].filter(r=>r.kind==='note'));
    unique&&=new Set(rows.map(r=>r.key)).size===rows.length;
    rows.forEach(r=>found.add(r.id));
    bottom=await page.evaluate(()=>window.messages.filter(m=>m.t==='rows'&&m.sub==='ch-room').at(-1)?.atBottom);
    if(bottom)break;
    const key=rows.at(-1).key;
    await send({t:'window',sub:'ch-room',anchor:{key},before:0,after:50});
    await page.waitForTimeout(600);
  }
  check(`channel paging reaches first message without gaps or duplicates (${found.size}/${history.length}, bottom=${bottom})`,bottom&&unique&&found.size===history.length&&history.every(e=>found.has(e.id)));
  check('channel paging asks older timestamps on the shared scheduler',fake.requests.some(f=>f.kinds?.includes(42)&&f.until));
  await send({t:'window',sub:'ch-room',anchor:'top',before:0,after:50});
  const live=await sign(42,Math.floor(Date.now()/1000)-2,'Channel live arrival',root(c[0].id));fake.add(live);
  await wait(id=>window.channelRows['ch-room']?.[1]?.id===id,live.id);
  check('other-client channel message patches the top live',true);
  await send({t:'window',sub:'ch-room',anchor:{key:history.at(-1).id},before:0,after:20});
  const anchored=await sign(42,live.created_at+1,'anchored fresh',root(c[0].id));fake.add(anchored);
  await wait(()=>window.channelFresh['ch-room']>0);
  check('anchored channel arrivals count as fresh',await page.evaluate(id=>!window.channelRows['ch-room'].some(r=>r.id===id),anchored.id));
  await send({t:'window',sub:'ch-room',anchor:'top',before:0,after:50});
  const edited=await sign(41,1700500000,JSON.stringify({name:'Renamed garden',about:'updated',relays:[route]}),root(c[0].id));fake.add(edited);
  await wait(()=>window.channelRows['ch-room']?.[0]?.name==='Renamed garden'&&window.channelRows['ch-room']?.[1]?.channel?.name==='Renamed garden');
  check('creator metadata patches header list and message channel names',await page.evaluate(()=>window.channelRows['ch-list'][0].name==='Renamed garden'));
  fake.add(await bunker.fixture(41,root(c[0].id),1800500000));
  await page.waitForTimeout(300);
  check('newer kind 41 signed by a noncreator is ignored',await page.evaluate(()=>window.channelRows['ch-room'][0].name==='Renamed garden'));
  check('empty channel name is rejected',(await act({a:'channel.save',as:note.pubkey,channel:{name:' ',about:''}},true)).error?.code==='rejected');
  const foreign=await bunker.fixture(40,[],1700001000);fake.add(foreign);
  await open('ch-foreign',{source:'channel',id:foreign.id});await wait(id=>window.channelRows['ch-foreign']?.[0]?.creator?.pubkey===id,foreign.pubkey);
  check('editing another creator channel is rejected',(await act({a:'channel.save',as:note.pubkey,id:foreign.id,channel:{name:'stolen',about:''}},true)).error?.code==='rejected');
  await send({t:'close',sub:'ch-foreign'});
  check('channel join publishes kind 10005',(await act({a:'channel.join',as:note.pubkey,id:c[3].id,on:true},true)).ok);
  await wait(id=>window.channelRows['ch-list']?.[3]?.id===id&&window.channelRows['ch-list'][3].joined,c[3].id);
  check('joining appends to the joined part before the others',true);
  check('channel leave publishes replacement list',(await act({a:'channel.join',as:note.pubkey,id:c[3].id,on:false},true)).ok);
  await wait(id=>window.channelRows['ch-list'].some(r=>r.id===id&&!r.joined),c[3].id);
  check('leaving patches every joined flag',true);
  check('channel seen records a device mark',(await act({a:'channel.seen',as:note.pubkey,id:c[0].id})).ok);
  await wait(()=>window.channelRows['ch-list'][0].unread===0);
  check('seen clears channel unread without publishing',true);
  const created=await act({a:'channel.save',as:note.pubkey,channel:{name:'test',about:'created'}},true);
  check('creating a channel signs kind 40 and kind 10005 and returns creation id',created.ok&&fake.published.some(e=>e.id===created.id&&e.kind===40)&&fake.published.some(e=>e.kind===10005&&e.tags.some(t=>t[1]===created.id)));
  await open('ch-created',{source:'channel',id:created.id,account:note.pubkey});
  await wait(()=>window.channelRows['ch-created']?.[0]?.own&&window.channelRows['ch-created']?.[0]?.joined);
  check('new channel is joined own and opens with empty message list',await page.evaluate(()=>window.channelRows['ch-created'].length===1));
  const published=await act({a:'publish',as:note.pubkey,what:{k:'note',draft:{text:'channel publication',channel:created.id}}},true);
  const message=fake.published.find(e=>e.id===published.id);
  check('channel draft publishes kind 42 root and existing client tag',published.ok&&message?.kind===42&&message.tags.some(t=>t[1]===created.id&&t[3]==='root')&&message.tags.some(t=>t[0]==='client'));
  await send({t:'configure',config:{language:'en',heuristics:true,prefetch:false,clientTag:false}});
  const untagged=await act({a:'publish',as:note.pubkey,what:{k:'note',draft:{text:'untagged channel publication',channel:created.id}}},true);
  check('channel client tag can be disabled',untagged.ok&&fake.published.some(e=>e.id===untagged.id&&e.kind===42&&!e.tags.some(t=>t[0]==='client')));
  await send({t:'configure',config:{language:'en',heuristics:true,prefetch:false}});
  const reply=await act({a:'publish',as:note.pubkey,what:{k:'note',draft:{text:'thread reply into channel',replyTo:published.id}}},true);
  check('thread draft infers channel without explicit channel',reply.ok&&fake.published.some(e=>e.id===reply.id&&e.kind===42&&e.tags.some(t=>t[1]===created.id&&t[3]==='root')&&e.tags.some(t=>t[1]===published.id&&t[3]==='reply')));
  check('editing own channel publishes creator metadata',(await act({a:'channel.save',as:note.pubkey,id:created.id,channel:{name:'Edited test',about:'updated'}},true)).ok);
  await wait(()=>window.channelRows['ch-created'][0].name==='Edited test'&&window.channelRows['ch-created'].slice(1).every(r=>r.channel.name==='Edited test'));
  check('metadata save patches existing message labels',true);
  check('channel message appears pending before confirmation',await page.evaluate(id=>window.messages.some(m=>m.sub==='ch-created'&&(m.rows??m.ops?.flatMap(o=>o.row?[o.row]:o.rows??[])??[]).some(r=>r.id===id&&r.pending)),published.id));
  await wait(id=>window.channelRows['ch-created'].some(r=>r.id===id&&!r.pending),published.id);
  check('confirmed channel message drops pending state',true);
  await open('ch-news',{source:'notifications',account:note.pubkey});
  await send({t:'close',sub:'ch-room'});
  await page.waitForTimeout(1100);
  // Diagnostic-only continuity runs avoid the separately retained same-second thread-order failure.
  const incomingAt=process.env.LKJSTR_CONTINUITY_DIAGNOSTIC==='1'?Math.max(Math.floor(Date.now()/1000),message.created_at+1):Math.floor(Date.now()/1000);
  if(process.env.LKJSTR_CONTINUITY_DIAGNOSTIC==='1'&&incomingAt*1000>Date.now())await page.waitForTimeout(incomingAt*1000-Date.now()+10);
  const incoming=await bunker.fixture(42,[...root(created.id),['e',published.id,route,'reply'],['p',note.pubkey]],incomingAt);fake.add(incoming);
  await wait(id=>window.channelRows['ch-list'].some(r=>r.id===id&&r.unread===1),created.id);
  check('closed joined channel counts messages from other authors unread',true);
  await wait(id=>window.channelRows['ch-news'].some(r=>r.type==='reply'&&r.note?.id===id&&r.note.channel),incoming.id);
  check('channel reply arrives in notifications with channel context',true);
  await open('ch-thread',{source:'thread',id:incoming.id,account:note.pubkey});
  await wait(()=>window.channelRows['ch-thread']?.length===2);
  check('notification thread shows exchange without channel creation ancestor',await page.evaluate(()=>window.channelRows['ch-thread'].every(r=>r.kind==='note'&&r.channel)&&window.channelRows['ch-thread'][0].thread.role==='ancestor'));
  check('seen after incoming reply clears unread',(await act({a:'channel.seen',as:note.pubkey,id:created.id})).ok);
  await wait(id=>window.channelRows['ch-list'].some(r=>r.id===id&&r.unread===0),created.id);
  check('channel reply bookmark publishes',(await act({a:'bookmark',as:note.pubkey,id:incoming.id,on:true},true)).ok);
  await open('ch-bookmarks',{source:'bookmarks',account:note.pubkey});
  await wait(id=>window.channelRows['ch-bookmarks'].some(r=>r.id===id&&r.channel),incoming.id);
  check('bookmarks retain channel context',true);
  check('ordinary mute applies inside a channel',(await act({a:'mute',as:note.pubkey,target:{k:'person',pubkey:incoming.pubkey},on:true},true)).ok);
  await wait(id=>!window.channelRows['ch-created'].some(r=>r.id===id),incoming.id);
  check('muted channel author disappears from open messages',true);
  await act({a:'mute',as:note.pubkey,target:{k:'person',pubkey:incoming.pubkey},on:false},true);
  const fresh=await page.context().browser().newContext();
  await fresh.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
  const other=await fresh.newPage();await other.goto(origin);
  await other.evaluate(()=>{window.messages=[];window.worker=new Worker('/worker.js',{type:'module'});window.worker.onmessage=e=>window.messages.push(e.data);});
  await other.waitForFunction(()=>window.messages.some(m=>m.t==='ready'));
  await other.evaluate(({route,account})=>{window.worker.postMessage({t:'relays',relays:[{url:route,read:true,write:true,search:false}]});window.worker.postMessage({t:'open',sub:'joined',query:{source:'channels',account}});},{route,account:note.pubkey});
  await other.waitForFunction(id=>window.messages.some(m=>m.sub==='joined'&&(m.rows??m.ops?.flatMap(o=>o.row?[o.row]:o.rows??[])??[]).some(r=>r.id===id&&r.joined)),created.id);
  check('fresh device reload recovers joined channels from kind 10005 relays',true);
  await fresh.close();
  for(const sub of ['ch-news','ch-thread','ch-bookmarks'])await send({t:'close',sub});
  for(const [what,kind] of [[{k:'reaction',id:published.id,emoji:'+'},7],[{k:'repost',id:published.id},16]]){
    const result=await act({a:'publish',as:note.pubkey,what},true);check(`channel ${what.k} uses kind ${kind}`,result.ok&&fake.published.some(e=>e.id===result.id&&e.kind===kind));
  }
  await open('ch-global',{source:'global',account:note.pubkey});await page.waitForTimeout(300);
  check('Global never includes channel message rows',await page.evaluate(()=>window.channelRows['ch-global'].every(r=>!r.channel)));
  const deleted=await act({a:'publish',as:note.pubkey,what:{k:'delete',id:published.id}},true);
  check('channel message deletion publishes kind 5',deleted.ok&&fake.published.some(e=>e.id===deleted.id&&e.kind===5&&e.tags.some(t=>t[0]==='e'&&t[1]===published.id)));
  await wait(id=>!window.channelRows['ch-created'].some(r=>r.id===id),published.id);
  check('deleted channel message leaves the open window',true);
  // Persisted joined state is also independently recoverable from signed relay data.
  check('latest joined-channel list names the created channel',fake.published.filter(e=>e.kind===10005).at(-1).tags.some(t=>t[0]==='e'&&t[1]===created.id));
  for(const sub of ['ch-list','ch-room','ch-created','ch-global'])await send({t:'close',sub});
  for(const a of ['channel.join','channel.save','channel.seen'])kinds.add(a);
  await act({a:'relays.save',as:note.pubkey,relays:[{url:origin.replace('http:','ws:'),read:true,write:true}]},true);
}
