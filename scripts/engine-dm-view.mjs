// Read only typed projections; policy and parsing stay in the real Worker/Core.
export async function emptyRoom({send,settle,check,local,peer}) {
  const sub='dm-empty-room';
  try {
    await send({t:'dm.open',sub,query:{account:local,participants:[peer,local,peer],limit:100}});
    const all=await settle(all=>all.some(m=>m.t==='dm'&&m.sub===sub&&m.snapshot.conversation));
    const snapshot=all.filter(m=>m.t==='dm'&&m.sub===sub).at(-1).snapshot;
    check('DM empty-room identity and public people are engine-projected',
      /^[a-f0-9]{64}$/.test(snapshot.conversation)&&snapshot.messages.length===0
      &&new Set(snapshot.people?.map(p=>p.pubkey)).size===2);
    return snapshot.conversation;
  } finally { await send({t:'dm.close',sub}); }
}
export async function privatePresentation({send,settle,check,local,firstText,received}) {
  const parts=received.last.segments??[];
  check('DM decrypted body carries inert text/link/custom-emoji parts',
    parts.some(s=>s.k==='text')&&parts.some(s=>s.k==='link')&&parts.some(s=>s.k==='emoji')
    &&!parts.some(s=>s.k==='media'||s.k==='quote'));
  check('DM conversation projects recent distinct other authors',
    received.recentAuthors?.length===1&&received.recentAuthors[0]===received.last.author);
  const sub='dm-count-only';
  try {
    await send({t:'dm.open',sub,query:{account:local,unreadOnly:true}});
    const all=await settle(all=>all.filter(m=>m.t==='dm'&&m.sub===sub).at(-1)?.snapshot.unread===1);
    const snapshot=all.filter(m=>m.t==='dm'&&m.sub===sub).at(-1).snapshot;
    check('DM frame subscription receives unread count without any private preview',
      snapshot.messages.length===0&&snapshot.conversations.length===0&&!(snapshot.people?.length)
      &&!JSON.stringify(snapshot).includes(firstText));
  } finally { await send({t:'dm.close',sub}); }
}
export async function partialDelivery({action,check,fake,local,recipients}) {
  try {
    fake.setAcceptance(event=>event.kind!==1059||!event.tags.some(t=>t[0]==='p'&&t[1]===recipients[1]));
    const partial=await action({a:'dm.send',as:local,draft:{recipients,text:'private partial fixture'}});
    check('DM rejected recipient keeps a partial outcome despite the accepted own copy',
      !partial.ok&&partial.dmDelivery?.accepted===2&&partial.dmDelivery.total===3);
    fake.setAcceptance(event=>event.kind!==1059);
    const none=await action({a:'dm.send',as:local,draft:{recipients,text:'private all-rejected fixture'}});
    check('DM zero accepted recipients is distinct from a signer failure',
      !none.ok&&none.dmDelivery?.accepted===0&&none.dmDelivery.total===3);
  } finally { fake.setAcceptance(()=>true); }
}
export async function withdrawInbox({action,send,settle,check,local,peer}) {
  check('DM empty inbox advertisement is an explicit withdrawal',
    (await action({a:'dm.relays.save',as:local,relays:[]})).ok);
  const sub='dm-withdrawn';
  try {
    await send({t:'dm.open',sub,query:{account:local,participants:[peer]}});
    const all=await settle(all=>all.filter(m=>m.t==='dm'&&m.sub===sub).at(-1)?.snapshot.blocked?.includes(local));
    check('DM withdrawn inbox blocks its owner without blocking a known recipient',
      all.filter(m=>m.t==='dm'&&m.sub===sub).at(-1).snapshot.blocked.join(',')===local);
    await settle(all=>all.filter(m=>m.t==='accounts').at(-1)?.accounts.some(a=>a.author.pubkey===local&&a.inbox?.length===0));
    check('DM settings receives the verified empty inbox list',true);
  } finally { await send({t:'dm.close',sub}); }
}
