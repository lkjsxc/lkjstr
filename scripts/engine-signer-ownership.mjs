import { assertOwnership } from '../web/tests/signer-ownership-fixture.ts';

export async function checkExtensionBridge({send,wait,page,check,note,signer,lines,fake}) {
  await send({t:'act',req:'discover',action:{a:'account.add',how:'extension'}});
  await wait(()=>window.messages.some(m=>m.t==='getPublicKey'&&m.req==='discover'));
  assertOwnership('discovery',await page.evaluate(()=>window.messages.find(m=>m.t==='getPublicKey'&&m.req==='discover')),{runtime:true});
  check('native discovery ownership fixture matches Worker',true);
  await send({t:'publicKey',req:'discover',pubkey:note.pubkey});
  await wait(()=>window.messages.some(m=>m.t==='result'&&m.req==='discover'&&m.ok));
  await send({t:'act',req:'publish',action:{a:'publish',as:note.pubkey,what:{k:'note',draft:{text:'published through sign bridge #Nostr'}}}});
  await wait(()=>window.messages.some((m)=>m.t==='sign'&&m.req==='publish'));
  const publishSign=await page.evaluate(()=>window.messages.find(m=>m.t==='sign'&&m.req==='publish'));
  assertOwnership('core-publish',publishSign,{runtime:true});
  check('native core publish ownership fixture matches Worker',true);
  const unsigned=publishSign.event;
  check('finished publication derives hashtag tags before signing',JSON.parse(unsigned).tags.some(t=>t[0]==='t'&&t[1]==='nostr'));
  signer.stdin.write(`${unsigned}\n`);
  const signed=JSON.parse((await lines.next()).value);
  await send({t:'signed',req:'publish',event:JSON.stringify(signed)});
  await wait(()=>window.messages.some((m)=>m.t==='result'&&m.req==='publish'));
  const result=await page.evaluate(()=>window.messages.find((m)=>m.t==='result'&&m.req==='publish'));
  check('NIP-07 bridge verifies and publishes with per-relay delivery',result.ok&&result.delivery[0]?.state==='ok'&&fake.published.some((e)=>e.id===signed.id));
}
