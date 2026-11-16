import { privateEditorLocks } from './engine-editors.mjs';
import { privateDrafts } from './engine-drafts.mjs';
import { emptyRoom, privatePresentation, partialDelivery, withdrawInbox } from './engine-dm-view.mjs';
// Explicit loopback-only DM conformance; fixture secrets remain in Rust signers.
export async function directMessages({page, send, wait, check, note, signer, lines, origin, bunker, fake, act, kinds}) {
  const messages = () => page.evaluate(() => window.messages);
  const handled = new Set((await messages()).filter(m => m.t === 'sign' || m.t === 'crypt').map(m => m.req));
  let serial = 0;
  async function settle(predicate) {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const all = await messages();
      for (const request of all.filter(m => (m.t === 'sign' || m.t === 'crypt') && !handled.has(m.req))) {
        handled.add(request.req);
        if (request.pubkey !== note.pubkey) throw new Error('unexpected private signer account');
        if (request.t === 'sign') {
          signer.stdin.write(request.event + '\n');
          const event = JSON.parse((await lines.next()).value);
          await send({t:'signed',req:request.req,event:JSON.stringify(event)});
        } else {
          signer.stdin.write(JSON.stringify({fixtureCrypto:request}) + '\n');
          const reply = JSON.parse((await lines.next()).value);
          await send({t:'crypted',req:request.req,value:reply.value});
        }
      }
      if (predicate(all)) return all;
      await page.waitForTimeout(25);
    }
    throw new Error('private conformance timed out');
  }
  async function action(action) {
    kinds.add(action.a);
    const req = 'dm-contract-' + (++serial);
    await send({t:'act',req,action});
    const all = await settle(all => all.some(m => m.t === 'result' && m.req === req));
    return all.find(m => m.t === 'result' && m.req === req);
  }
  const relay = origin.replace('http:','ws:');
  await send({t:'relays',relays:[{url:relay,read:true,write:true,search:true}]});
  check('DM local fixture account creates', (await act({a:'account.add',how:'create'})).ok);
  const local = (await messages()).filter(m=>m.t==='accounts').at(-1).active;
  check('DM own inbox list publishes with local signer', (await action({a:'dm.relays.save',as:local,relays:[relay]})).ok);
  check('DM external inbox list signs exact kind10050', (await action({a:'dm.relays.save',as:note.pubkey,relays:[relay]})).ok);
  check('DM bunker connects', (await act({a:'account.add',how:'key',key:'bunker://'+bunker.pubkey+'?relay='+encodeURIComponent(relay+'/bunker')})).ok);
  check('DM bunker inbox list publishes', (await action({a:'dm.relays.save',as:bunker.pubkey,relays:[relay]})).ok);
  const subs = [['dm-local',local],['dm-extension',note.pubkey],['dm-remote',bunker.pubkey]];
  for (const [sub, account] of subs) await send({t:'dm.open',sub,query:{account}});
  const room = await emptyRoom({send,settle,check,local,peer:note.pubkey});
  const firstText = 'private fixture extension to local :wave: https://example.test/photo.png';
  const before = fake.published.length;
  const first = await action({a:'dm.send',as:note.pubkey,draft:{recipients:[local],text:firstText,
    emoji:[{code:'wave',url:'https://example.test/wave.png'}]}});
  check('DM extension sends own archive and recipient gift wrap',first.ok);
  check('DM extension counts recipient and self once',first.dmDelivery?.accepted===2&&first.dmDelivery.total===2);
  let all = await settle(all => all.some(m=>m.t==='dm'&&m.sub==='dm-local'&&m.snapshot.conversations.some(c=>c.last.text===firstText)));
  const wraps = fake.published.slice(before).filter(e=>e.kind===1059);
  check('DM sends distinct ephemeral wrappers only',wraps.length===2&&new Set(wraps.map(e=>e.pubkey)).size===2&&wraps.every(e=>e.pubkey!==note.pubkey&&e.tags.length===1&&e.tags[0][0]==='p'));
  check('DM plaintext and seals never publish',fake.published.slice(before).every(e=>e.kind!==13&&e.kind!==14&&e.kind!==4&&!e.content.includes(firstText)));
  const received = all.filter(m=>m.t==='dm'&&m.sub==='dm-local').at(-1).snapshot.conversations.find(c=>c.last.text===firstText);
  check('DM received conversation is unread exactly once',received.unread===1);
  check('DM new-room identity matches the authenticated message',received.key===room);
  await privatePresentation({send,settle,check,local,firstText,received});
  await send({t:'dm.open',sub:'dm-local',query:{account:local,conversation:received.key}});
  await settle(all=>all.some(m=>m.t==='dm'&&m.sub==='dm-local'&&m.snapshot.messages.some(m=>m.text===firstText)));
  check('DM marking seen commits', (await action({a:'dm.seen',as:local,conversation:received.key})).ok);
  await settle(all=>all.filter(m=>m.t==='dm'&&m.sub==='dm-local').at(-1)?.snapshot.conversations.find(c=>c.key===received.key)?.unread===0);
  const reply = await action({a:'dm.send',as:local,draft:{recipients:[note.pubkey],
    text:'private fixture same-room reply',replyTo:received.last.id,subject:'private subject'}});
  check('DM local reply counts two distinct recipients',reply.ok&&reply.dmDelivery?.accepted===2&&reply.dmDelivery.total===2);
  all=await settle(all=>all.filter(m=>m.t==='dm'&&m.sub==='dm-local').at(-1)?.snapshot.messages.some(m=>m.id===reply.id));
  const quoted=all.filter(m=>m.t==='dm'&&m.sub==='dm-local').at(-1).snapshot.messages.find(m=>m.id===reply.id);
  check('DM reply excerpt and subject come from the authenticated private room',
    quoted.reply?.id===received.last.id&&quoted.reply.author===note.pubkey&&quoted.reply.excerpt===firstText&&quoted.subject==='private subject');
  const backup = await action({a:'account.exportEncrypted',pubkey:local,password:'private test password',logN:16});
  check('DM fixture obtains an explicit encrypted backup',backup.ok&&backup.encryptedKey?.startsWith('ncryptsec1'));
  check('DM fixture imports encrypted local storage',(await action({a:'account.importEncrypted',key:backup.encryptedKey,password:'private test password'})).ok);
  fake.setReading(false);
  try {
    check('DM account lock commits',(await action({a:'account.lock',pubkey:local})).ok);
    await settle(all=>{const s=all.filter(m=>m.t==='dm'&&m.sub==='dm-local').at(-1)?.snapshot;return s?.phase==='failed'&&s.error==='signer-missing'&&s.messages.length===0&&s.conversations.length===0;});
    check('DM lock removes decrypted rows and reports locked access',true);
    check('DM unlock commits',(await action({a:'account.unlock',pubkey:local,password:'private test password'})).ok);
    await settle(all=>all.filter(m=>m.t==='dm'&&m.sub==='dm-local').at(-1)?.snapshot.messages.some(m=>m.text===firstText));
    check('DM unlock decrypts the unchanged encrypted cache without relay replay',true);
    const afterUnlock=(await messages()).filter(m=>m.t==='dm'&&m.sub==='dm-local').at(-1).snapshot;
    check('DM unlock preserves committed read state',afterUnlock.conversations.find(c=>c.key===received.key)?.unread===0);
  } finally { fake.setReading(true); }
  const secondText = 'private fixture local to extension and bunker';
  const group=await action({a:'dm.send',as:local,draft:{recipients:[note.pubkey,bunker.pubkey],text:secondText}});
  check('DM local sends a group to each participant inbox',group.ok&&group.dmDelivery?.accepted===3&&group.dmDelivery.total===3);
  await settle(all=>['dm-extension','dm-remote'].every(sub=>all.some(m=>m.t==='dm'&&m.sub===sub&&m.snapshot.conversations.some(c=>c.last.text===secondText))));
  check('DM extension and bunker both decrypt authenticated messages',true);
  const thirdText = 'private fixture remote reply';
  const remote=await action({a:'dm.send',as:bunker.pubkey,draft:{recipients:[local],text:thirdText}});
  check('DM bunker encrypts and signs sender seal',remote.ok&&remote.dmDelivery?.accepted===2&&remote.dmDelivery.total===2);
  await settle(all=>all.some(m=>m.t==='dm'&&m.sub==='dm-local'&&m.snapshot.conversations.some(c=>c.last.text===thirdText)));
  check('DM remote sends use both encrypt and decrypt RPCs',bunker.calls.some(c=>c.method==='nip44_encrypt')&&bunker.calls.some(c=>c.method==='nip44_decrypt'));
  check('DM requires recipient advertised inbox', (await action({a:'dm.send',as:local,draft:{recipients:['f'.repeat(64)],text:'must not publish'}})).ok===false);
  await partialDelivery({action,check,fake,local,recipients:[note.pubkey,bunker.pubkey]});
  await send({t:'dm.more',sub:'dm-local'});
  await send({t:'dm.visible',sub:'dm-local',visible:false});
  await send({t:'dm.visible',sub:'dm-local',visible:true});
  for (const [sub] of subs) await send({t:'dm.close',sub});
  await page.waitForTimeout(300);
  if (fake.activeFilters) check('DM closing views releases encrypted inbox requests', !fake.activeFilters().some(f=>f.kinds?.includes(1059)||f.kinds?.includes(4)));
  await withdrawInbox({action,send,settle,check,local,peer:note.pubkey});
  await privateDrafts({page,origin,note,signer,lines,bunker,check,kinds,fake});
  await privateEditorLocks({page,origin,check,kinds});
  check('DM account cleanup removes local private access', (await act({a:'account.remove',pubkey:local})).ok);
  check('DM account cleanup removes bunker session', (await act({a:'account.remove',pubkey:bunker.pubkey})).ok);
}
