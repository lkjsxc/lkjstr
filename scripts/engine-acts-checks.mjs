// Production projections only; no renderer, signing or public publication in this proof.
const quantitative = row => row && ({ replies: row.counts.replies, reposts: row.counts.reposts,
  reactions: row.counts.reactions, zaps: row.counts.zaps, chips: row.reactions, mine: row.mine });
export async function exerciseActs({ data: d, relay, send, state, until, check }) {
  const visible = new Set();
  const rows = (s, sub) => s.rows[sub] ?? [];
  const note = (s, sub, id) => rows(s, sub).find(row => row.kind === 'note' && row.id === id);
  const notification = (s, event, type = event.kind === 7 ? 'reaction' : 'repost') =>
    rows(s, 'acts-notifications').find(row => row.kind === 'notification' && row.type === type && row.at === event.created_at * 1000);
  const hint = () => send({ t: 'hint', hint: { visibleSubs: [...visible], pageHidden: false, idle: false, saveData: false } });
  const open = async (sub, query) => {
    visible.add(sub); await send({ t: 'open', sub, query: { account: d.owner, ...query } });
    await send({ t: 'window', sub, anchor: 'top', before: 0, after: 100 }); await hint();
  };
  const close = async sub => { visible.delete(sub); await send({ t: 'close', sub }); await hint(); };
  await open('acts-base', { source: 'thread', id: d.base.id });
  const baselineReady = await until(s => {
    const row = note(s, 'acts-base', d.base.id);
    return row?.counts.reactions === 3 && row.counts.reposts === 1 && row.reactions.some(chip => chip.emoji === '⭐' && chip.mine);
  });
  check('signed terminal note and own direct reaction establish a quantitative baseline', baselineReady);
  if (!baselineReady) throw Error('act fixture baseline did not reach verified projection');
  const baseline = quantitative(note(await state(), 'acts-base', d.base.id));
  await open('acts-second', { source: 'thread', id: d.second.id });
  const secondReady = await until(s => {
    const row = note(s, 'acts-second', d.second.id);
    return row?.counts.reposts >= 2 && row.mine.reposted;
  });
  check('second terminal establishes its direct repost count and own repost baseline', secondReady);
  if (!secondReady) throw Error('second terminal baseline did not reach verified projection');
  const secondBaseline = quantitative(note(await state(), 'acts-second', d.second.id));
  await open('acts-notifications', { source: 'notifications' });
  relay.add(d.stages.primary);
  await until(s => rows(s, 'acts-notifications').some(row => row.emoji?.emoji === d.emoji.emoji
    && row.actors.length === 2 && row.target?.id === d.base.id)
    && notification(s, d.reactionRepost)?.target?.id === d.second.id
    && notification(s, d.repostStar)?.target?.id === d.base.id
    && notification(s, d.repostRepost)?.target?.id === d.second.id, 3000);
  let snapshot = await state();
  const grouped = rows(snapshot, 'acts-notifications').find(row => row.emoji?.emoji === d.emoji.emoji);
  const direct = notification(snapshot, d.directNew);
  check('A1 groups two outer custom reactions on the owner star with a terminal note target',
    grouped?.actors.length === 2 && grouped.actors.every(actor => [d.person, d.other].includes(actor.pubkey))
    && grouped.target?.id === d.base.id && grouped.target.act?.type === 'reaction'
    && grouped.target.act.actor.pubkey === d.owner && grouped.target.act.emoji?.emoji === '⭐'
    && grouped.target.excerpt.includes(d.base.content) && grouped.emoji.url === d.emoji.url);
  check('direct-note and own-act notification groups keep different stable identities',
    !!grouped && !!direct && grouped.key !== direct.key && direct.target?.id === d.base.id && !direct.target.act);
  for (const [event, type, actType, terminal] of [[d.reactionRepost, 'reaction', 'repost', d.second],
    [d.repostStar, 'repost', 'reaction', d.base], [d.repostRepost, 'repost', 'repost', d.second]]) {
    const row = notification(snapshot, event, type);
    check(`A1 ${type} on own ${actType} resolves the correct terminal note`, row?.target?.id === terminal.id
      && row.target.act?.type === actType && row.target.act.actor.pubkey === d.owner);
  }
  check('indirect acts do not alter terminal counts, chips or own heart',
    JSON.stringify(quantitative(note(snapshot, 'acts-base', d.base.id))) === JSON.stringify(baseline));
  await open('acts-reactions', { source: 'profile', pubkey: d.person, show: 'reactions' });
  await until(s => note(s, 'acts-reactions', d.base.id)?.actOn?.type === 'reaction'
    && !!note(s, 'acts-reactions', d.second.id), 3000); snapshot = await state();
  let profile = rows(snapshot, 'acts-reactions').filter(row => row.kind === 'note');
  const selected = profile.find(row => row.id === d.base.id);
  check('A2 reaction profile lists the terminal note once and prefers its newest indirect act',
    profile.filter(row => row.id === d.base.id).length === 1 && selected?.actOn?.type === 'reaction'
    && selected.actOn.actor.pubkey === d.owner && selected.act?.actor.pubkey === d.person
    && selected.act.emoji?.emoji === d.emoji.emoji && selected.at === d.reactionStar.created_at * 1000);
  check('A2 ordering follows selected outer-act time and keeps final-note chips native',
    profile.findIndex(row => row.id === d.second.id) < profile.findIndex(row => row.id === d.base.id)
    && selected?.reactions.every(chip => chip.emoji !== d.emoji.emoji));
  await close('acts-reactions');
  await open('acts-reposts', { source: 'profile', pubkey: d.person, show: 'reposts' });
  await until(s => note(s, 'acts-reposts', d.second.id)?.actOn?.type === 'repost', 3000); snapshot = await state();
  const repostRow = note(snapshot, 'acts-reposts', d.second.id);
  check('A2 repost profile preserves the immediate act and selected repost time',
    rows(snapshot, 'acts-reposts').filter(row => row.id === d.second.id).length === 1
    && repostRow?.act?.type === 'repost' && repostRow.actOn?.type === 'repost'
    && repostRow.at === d.repostRepost.created_at * 1000 && repostRow.repostedBy?.at === repostRow.at);
  check('profile-only act context does not leak into the thread projection',
    !note(snapshot, 'acts-base', d.base.id)?.act && !note(snapshot, 'acts-base', d.base.id)?.actOn);
  await close('acts-reposts');
  await close('acts-notifications');
  await open('acts-notifications', { source: 'notifications', types: ['reaction'] });
  await until(s => rows(s, 'acts-notifications').some(row => row.emoji?.emoji === d.emoji.emoji)
    && rows(s, 'acts-notifications').every(row => row.type === 'reaction'), 2000);
  snapshot = await state();
  check('notification type filters follow the outer act type', rows(snapshot, 'acts-notifications').length > 0
    && rows(snapshot, 'acts-notifications').every(row => row.type === 'reaction'));
  await close('acts-notifications'); await open('acts-notifications', { source: 'notifications' });
  relay.add(d.stages.pending);
  await until(s => notification(s, d.pendingOuter)?.pendingAct?.state === 'loading', 3000);
  const pending = notification(await state(), d.pendingOuter);
  check('unavailable terminal note is loading with an own-act chip and no target excerpt',
    pending?.pendingAct?.state === 'loading' && pending.pendingAct.act.actor.pubkey === d.owner && !pending.target);
  check('missing chain terminal is requested by exact id', await until(() =>
    relay.requests.some(req => req.filters.some(filter => filter.ids?.includes(d.pendingNote.id))), 3000));
  relay.release(d.pendingNote.id);
  await until(s => notification(s, d.pendingOuter)?.target?.id === d.pendingNote.id, 3000);
  const resolved = notification(await state(), d.pendingOuter);
  check('delayed terminal hydration redraws the same notification row in place',
    !!pending && resolved?.key === pending.key && resolved.target?.id === d.pendingNote.id
    && resolved.target.act?.type === 'reaction' && !resolved.pendingAct);
  relay.add(d.stages.missing);
  await until(s => notification(s, d.missingOuter)?.pendingAct?.state === 'missing', 3000);
  const missing = notification(await state(), d.missingOuter);
  check('completed empty lookup reports missing without a raw-act excerpt', missing?.pendingAct?.state === 'missing' && !missing.target);
  relay.add(d.stages.failed);
  await until(s => notification(s, d.failedOuter)?.pendingAct?.state === 'failed', 3000);
  const failed = notification(await state(), d.failedOuter);
  check('refused lookup reports failed distinctly from empty missing', failed?.pendingAct?.state === 'failed' && !failed.target);
  relay.add(d.stages.depth);
  await until(s => notification(s, d.fourEdges)?.target?.id === d.depthNote.id, 3000);
  snapshot = await state();
  check('four last-e edges resolve and a fifth edge remains bounded failed',
    notification(snapshot, d.fourEdges)?.target?.id === d.depthNote.id
    && notification(snapshot, d.fiveEdges)?.pendingAct?.state === 'failed');
  relay.add(d.stages.zaps);
  check('visible receipt chains discover their provider without a signing or payment action',
    await until(s => rows(s, 'acts-notifications').some(row => row.type === 'zap' && row.key === d.zap.id), 5000));
  await send({ t: 'zap.quote', req: 'acts-provider', query: { target: { k: 'profile', pubkey: d.owner }, amountMsat: 21000 } });
  const provider = await until(s => s.quotes['acts-provider']?.phase === 'ready', 5000);
  check('owned LNURL response establishes the declared receipt provider', provider);
  await until(s => rows(s, 'acts-notifications').some(row => row.type === 'zap' && row.key === d.zap.id), 3000);
  snapshot = await state();
  const zap = rows(snapshot, 'acts-notifications').find(row => row.key === d.zap.id);
  check('trusted outer zap resolves an own reaction without adding terminal-note sats',
    zap?.type === 'zap' && zap.zapReceipt?.verification === 'provider-authorized' && zap.target?.id === d.base.id
    && zap.target.act?.type === 'reaction' && zap.actors[0]?.pubkey === d.person && zap.sats === 21
    && quantitative(note(snapshot, 'acts-base', d.base.id)).zaps === baseline.zaps);
  check('untrusted provider receipt is not promoted into a chain notification', !rows(snapshot, 'acts-notifications').some(row => row.key === d.untrustedZap.id));
  relay.add(d.stages.unsupported);
  await until(s => notification(s, d.unsupportedOuter)?.pendingAct?.state === 'failed', 3000);
  snapshot = await state();
  const unsupported = notification(snapshot, d.unsupportedOuter), onZap = notification(snapshot, d.zapTargetOuter);
  check('a profile JSON terminal is failed rather than rendered as note content', unsupported?.pendingAct?.state === 'failed' && !unsupported.target);
  check('an immediate zap target cannot invent an unsupported ActRef', !onZap?.target && !onZap?.pendingAct);
  await open('acts-zap-chain', { source: 'profile', pubkey: d.person, show: 'reactions',
    since: d.zapTargetOuter.created_at * 1000, until: d.zapTargetOuter.created_at * 1000 });
  await until(s => !!note(s, 'acts-zap-chain', d.base.id), 3000);
  const viaZap = note(await state(), 'acts-zap-chain', d.base.id);
  check('a trusted receipt link reaches the terminal note without inventing a third act shape',
    viaZap?.at === d.zapTargetOuter.created_at * 1000 && viaZap.act?.type === 'reaction'
    && !viaZap.actOn && viaZap.segments.some(part => part.text === d.base.content));
  await close('acts-zap-chain');
  await open('acts-final-profile', { source: 'profile', pubkey: d.person, show: 'reactions' });
  await until(s => !!note(s, 'acts-final-profile', d.depthNote.id), 3000); snapshot = await state();
  profile = rows(snapshot, 'acts-final-profile').filter(row => row.kind === 'note');
  check('A2 omits unsupported/missing terminals and keeps only resolved note identities',
    profile.some(row => row.id === d.depthNote.id && row.at === d.fourEdges.created_at * 1000)
    && profile.every(row => [d.base.id, d.second.id, d.pendingNote.id, d.depthNote.id].includes(row.id))
    && new Set(profile.map(row => row.id)).size === profile.length);
  check('all indirect and zap cases preserve both terminal-note quantitative states',
    JSON.stringify(quantitative(note(snapshot, 'acts-base', d.base.id))) === JSON.stringify(baseline)
    && JSON.stringify(quantitative(note(snapshot, 'acts-second', d.second.id))) === JSON.stringify(secondBaseline));
  await send({ t: 'zap.close', req: 'acts-provider' });
  for (const sub of [...visible]) await close(sub);
  check('closing every source releases the owned relay requests', await until(() => relay.active === 0, 3000));
  return { baseline, secondBaseline, primaryGroupKey: grouped?.key, pendingKey: pending?.key, resolvedKey: resolved?.key,
    terminalIds: profile.map(row => row.id) };
}
