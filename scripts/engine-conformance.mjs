import { relayAuth } from './engine-relay-auth.mjs';
import { directMessages } from './engine-dm.mjs';
import { hiddenDirectMessages } from './engine-dm-hidden.mjs';
import { vault } from './engine-vault.mjs';
import { channels } from './engine-channels.mjs';
// Runs within the real Worker harness; all fixture keys stay in the native signer.
import { validateReplies, actionKinds, sourceKinds, assertCoverage, mockActionKinds } from './engine-contract.mjs';
export async function conformance({page,send,wait,check,note,signer,lines,origin,bunkerKey,bunker,fake,channelFake,authFake}) {
  const messages = () => page.evaluate(() => window.messages);
  const result = async (req) => {
    await wait((r) => window.messages.some((m) => m.t === 'result' && m.req === r), req);
    return (await messages()).find((m) => m.t === 'result' && m.req === req);
  };
  const authenticate = (account,mode)=>relayAuth({page,send,wait,check,origin,account,signer,lines,authFake,mode,act});
  const kinds = new Set();
  let serial=0;
  async function act(action, signing = false) {
    kinds.add(action.a);
    const req=`contract-${++serial}`;
    await send({t:'act',req,action});
    if (signing) {
      const handled=new Set();
      for (;;) {
        await wait(({req,handled})=>window.messages.some(m=>(m.t==='result'&&m.req===req)||(m.t==='sign'&&m.req.startsWith(req)&&!handled.includes(m.req))),{req,handled:[...handled]});
        const all=await messages();
        if(all.some(m=>m.t==='result'&&m.req===req))break;
        const request=all.find(m=>m.t==='sign'&&m.req.startsWith(req)&&!handled.has(m.req));
        handled.add(request.req);signer.stdin.write(`${request.event}\n`);
        const signed=JSON.parse((await lines.next()).value);
        await send({t:'signed',req:request.req,event:JSON.stringify(signed)});
      }
    }
    return result(req);
  }
  await authenticate(note.pubkey,'extension');
  await send({t:'configure',config:{language:'en',heuristics:true,prefetch:false}});
  await send({t:'relays',relays:[{url:origin.replace('http:','ws:'),read:true,write:true,search:true}]});
  for (const source of sourceKinds) {
    const sub=`source-${source}`;
    await send({t:'open',sub,query:{source,account:note.pubkey,pubkey:note.pubkey,id:note.id,tag:'test',relay:origin.replace('http:','ws:')}});
    await send({t:'window',sub,anchor:'top',before:0,after:20});
    await wait((s)=>window.messages.some((m)=>m.t==='rows'&&m.sub===s),sub);
    await page.waitForTimeout(150);
    await send({t:'close',sub});
  }
  check('all protocol sources return typed windows',true);
  check('bad relay save rejects the entire action',(await act({a:'relays.save',as:note.pubkey,relays:[{url:'https://bad.test',read:true,write:true}] })).error?.code==='rejected');
  check('invalid media retry is rejected',(await act({a:'servers.check',server:'http://bad.test'})).error?.code==='rejected');
  check('bad server save rejects the entire action',(await act({a:'servers.save',as:note.pubkey,servers:['http://bad.test']})).error?.code==='rejected');
  check('relay usage flags survive signed replacement',(await act({a:'relays.save',as:note.pubkey,relays:[{url:origin.replace('http:','ws:'),read:true,write:true},{url:'wss://unused.test',read:false,write:false}]},true)).ok);
  check('server list replacement publishes',(await act({a:'servers.save',as:note.pubkey,servers:['https://media.engine.test']},true)).ok);
  for (const action of [
    {a:'follow',as:note.pubkey,pubkey:note.pubkey,on:false},
    ...[{k:'person',pubkey:note.pubkey},{k:'word',word:'test-word'},{k:'hashtag',tag:'test-tag'},{k:'thread',id:note.id}].map((target)=>({a:'mute',as:note.pubkey,target,on:false})),
    {a:'bookmark',as:note.pubkey,id:note.id,on:true},
    {a:'profile.save',as:note.pubkey,profile:{name:'Contract fixture',about:''}},
  ]) check(`action ${action.a} ${serial} publishes`,(await act(action,true)).ok);
  for (const what of [{k:'note',draft:{text:'contract note'}},{k:'note',draft:{text:'contract article',longForm:{identifier:'fixture-article',title:'Article'}}},{k:'note',draft:{text:'contract reply',replyTo:note.id}},{k:'note',draft:{text:'contract quote',quote:note.id}},{k:'reaction',id:note.id,emoji:'+'},{k:'repost',id:note.id},{k:'delete',id:note.id}]) {
    check(`publish ${what.k} ${serial} replies`,(await act({a:'publish',as:note.pubkey,what},true)).ok);
    const signed=(await messages()).filter(m=>m.t==='sign').at(-1);
    if(what.draft?.longForm)check('long-form draft becomes kind 30023',JSON.parse(signed.event).kind===30023);
    if(what.k!=='delete')check(`publish ${what.k} ${serial} carries client tag`,JSON.parse(signed.event).tags.some(t=>t[0]==='client'&&t[1]==='lkjstr'));
  }
  await send({t:'configure',config:{language:'en',heuristics:true,prefetch:false,clientTag:false}});
  check('client tag can be disabled',(await act({a:'publish',as:note.pubkey,what:{k:'note',draft:{text:'untagged'}}},true)).ok);
  check('disabled client tag is absent',!JSON.parse((await messages()).filter(m=>m.t==='sign').at(-1).event).tags.some(t=>t[0]==='client'));
  await send({t:'configure',config:{language:'en',heuristics:true,prefetch:false}});
  const req='upload-contract'; kinds.add('upload');
  const uploadHandled=(await messages()).filter(m=>m.t==='sign').map(m=>m.req);
  await page.evaluate(({req,key})=>window.worker.postMessage({t:'act',req,action:{a:'upload',as:key,name:'fixture.png',mime:'image/png',bytes:new Uint8Array([1,2,3,4]).buffer}}),{req,key:note.pubkey});
  await wait(used=>window.messages.some(m=>m.t==='sign'&&m.req.startsWith('upload-auth-')&&!used.includes(m.req)),uploadHandled);
  const uploadSign=(await messages()).find(m=>m.t==='sign'&&m.req.startsWith('upload-auth-')&&!uploadHandled.includes(m.req));
  check('Blossom auth is kind 24242 with upload hash and expiration',JSON.parse(uploadSign.event).kind===24242&&['t','x','expiration'].every(k=>JSON.parse(uploadSign.event).tags.some(t=>t[0]===k)));
  signer.stdin.write(`${uploadSign.event}\n`);const signed=JSON.parse((await lines.next()).value);
  await send({t:'signed',req:uploadSign.req,event:JSON.stringify(signed)});
  check('Blossom upload returns validated metadata',(await result(req)).uploaded?.sha256?.length===64);
  check('NIP-96 server replacement publishes',(await act({a:'servers.save',as:note.pubkey,servers:['https://nip96.engine.test']},true)).ok);
  const handled=new Set((await messages()).filter(m=>m.t==='sign').map(m=>m.req));
  await page.evaluate(key=>window.worker.postMessage({t:'act',req:'nip96-upload',action:{a:'upload',as:key,name:'fixture.png',mime:'image/png',bytes:new Uint8Array([1,2,3,4]).buffer}}),note.pubkey);
  for(let n=0;n<2;n++) {
    await wait(used=>window.messages.some(m=>m.t==='sign'&&m.req.startsWith('upload-auth-')&&!used.includes(m.req)),[...handled]);
    const request=(await messages()).find(m=>m.t==='sign'&&m.req.startsWith('upload-auth-')&&!handled.has(m.req));
    handled.add(request.req);signer.stdin.write(`${request.event}\n`);
    const event=JSON.parse((await lines.next()).value);
    await send({t:'signed',req:request.req,event:JSON.stringify(event)});
  }
  check('NIP-96 fallback uploads multipart with NIP-98 auth',(await result('nip96-upload')).uploaded?.mime==='image/png');
  check('local account creation commits',(await act({a:'account.add',how:'create'})).ok);
  const accounts=(await messages()).filter((m)=>m.t==='accounts').at(-1);
  const local=accounts.accounts.find((a)=>a.signer==='local').author.pubkey;
  const backup=await act({a:'account.key',pubkey:local});
  check('explicit local backup returns nsec',backup.ok && /^nsec1/.test(backup.key));
  // Validate in memory, then erase the secret before any failure diagnostics.
  validateReplies([backup]);
  await page.evaluate(()=>{for(const m of window.messages)if(m.key)m.key='[redacted]';});
  check('external account backup is unsupported',(await act({a:'account.key',pubkey:note.pubkey})).error?.code==='unsupported');
  check('missing account backup is not found',(await act({a:'account.key',pubkey:'0'.repeat(64)})).error?.code==='not-found');
  check('account switching commits',(await act({a:'account.use',pubkey:local})).ok);
  check('seen commits a read watermark',(await act({a:'seen',as:local})).ok);
  check('local signing needs no main-thread signer',(await act({a:'publish',as:local,what:{k:'note',draft:{text:'local signing fixture'}}})).ok);
  await authenticate(local,'local');
  check('account removal commits',(await act({a:'account.remove',pubkey:local})).ok);
  check('bad account import rejects',(await act({a:'account.add',how:'key',key:'not-a-key'})).error?.code==='rejected');
  const remoteRelay=`${origin.replace('http:','ws:')}/remote-owner`;
  fake.add(await bunker.fixture(10002,[['r',remoteRelay]],1700000600));
  fake.add(await bunker.fixture(10063,[['server','https://media.engine.test']],1700000600));
  check('remote bunker connection commits only after get_public_key',(await act({a:'account.add',how:'key',key:`bunker://${bunkerKey}?relay=${encodeURIComponent(origin.replace('http:','ws:')+'/bunker')}`})).ok);
  await page.evaluate(key=>window.worker.postMessage({t:'act',req:'remote-owner-upload',action:{a:'upload',as:key,name:'fixture.png',mime:'image/png',bytes:new Uint8Array([1,2,3,4]).buffer}}),bunkerKey);
  check('immediate NIP-46 upload respects discovered kind 10063',(await result('remote-owner-upload')).uploaded?.url.startsWith('https://media.engine.test/'));
  await send({t:'open',sub:'remote-relays',query:{source:'relays',account:bunkerKey}});
  await wait(url=>window.messages.some(m=>m.sub==='remote-relays'&&(m.rows??m.ops?.flatMap(o=>o.row?[o.row]:o.rows??[])??[]).some(r=>r.url===url&&r.read&&r.write)),remoteRelay);
  check('NIP-46 sign-in discovers owner relay list from bootstrap',true);
  await send({t:'close',sub:'remote-relays'});
  check('remote signing validates and publishes',(await act({a:'publish',as:bunkerKey,what:{k:'note',draft:{text:'remote fixture'}}})).ok);
  await authenticate(bunkerKey,'remote');
  check('remote account removal commits',(await act({a:'account.remove',pubkey:bunkerKey})).ok);
  await channels({page,send,wait,check,note,signer,lines,fake:channelFake,origin,act,kinds,bunker});
  await directMessages({page,send,wait,check,note,signer,lines,origin,bunker,fake,act,kinds});
  await hiddenDirectMessages({page,origin,note,signer,lines,fake,check});
  await vault({page,send,wait,check,act,kinds,origin});
  assertCoverage(kinds,actionKinds,'action');
  assertCoverage(kinds,mockActionKinds,'mock action');
  validateReplies(await messages());
  check('every Worker reply satisfies fetched protocol types',true);
}
