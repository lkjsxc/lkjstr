// Synthetic public fixture topology. Signing is supplied by the existing native helper.
export async function buildActsData({ rpc, seed, now = Math.floor(Date.now() / 1000) }) {
  const events = [], start = now - 600;
  const make = async (author, kind, content, tags = [], offset = 0) => {
    const event = await rpc({ op: 'event', author, kind, content, tags, at: start + offset });
    events.push(event); return event;
  };
  const profiles = [seed.metadata];
  for (const [author, name] of [[3, 'acts-profile'], [5, 'acts-other'], [6, 'acts-note-author']])
    profiles.push(await make(author, 0, JSON.stringify({ name }), [], 1));
  const owner = seed.recipient, person = profiles[1].pubkey, other = profiles[2].pubkey;
  const base = await make(2, 1, 'Terminal act fixture note', [], 2);
  const second = await make(6, 1, 'Second terminal fixture note', [], 3);
  const pendingNote = await make(6, 1, 'Delayed terminal fixture note', [], 4);
  const depthNote = await make(6, 1, 'Four-edge terminal fixture note', [], 5);
  const edge = (target, pubkey) => [['e', target], ['p', pubkey]];
  const star = await make(2, 7, '⭐', edge(base.id, owner), 10);
  const repost = await make(2, 6, JSON.stringify(second), edge(second.id, second.pubkey), 11);
  const directOld = await make(3, 7, '+', edge(base.id, owner), 15);
  const directNew = await make(3, 7, '+', edge(base.id, owner), 50);
  const directBaseRepost = await make(3, 6, JSON.stringify(base), edge(base.id, owner), 51);
  const directSecondRepost = await make(3, 6, JSON.stringify(second), edge(second.id, second.pubkey), 52);
  const emoji = { emoji: ':spark:', url: 'https://acts.fixture.invalid/spark.png' };
  const customTags = [['e', second.id], ...edge(star.id, owner), ['emoji', 'spark', emoji.url]];
  const reactionStar = await make(3, 7, emoji.emoji, customTags, 20);
  const reactionStarOther = await make(5, 7, emoji.emoji, customTags, 21);
  const reactionRepost = await make(3, 7, '+', edge(repost.id, owner), 22);
  const repostStar = await make(5, 16, JSON.stringify(star), [...edge(star.id, owner), ['k', '7']], 23);
  const repostRepost = await make(3, 16, JSON.stringify(repost), [...edge(repost.id, owner), ['k', '6']], 24);
  const pendingAct = await make(2, 7, '⭐', edge(pendingNote.id, pendingNote.pubkey), 60);
  const pendingOuter = await make(3, 7, '+', edge(pendingAct.id, owner), 61);
  const missingId = 'f'.repeat(64), failedId = 'e'.repeat(64);
  const missingAct = await make(2, 7, '⭐', edge(missingId, owner), 70);
  const missingOuter = await make(5, 7, '+', edge(missingAct.id, owner), 71);
  const failedAct = await make(2, 7, '⭐', edge(failedId, owner), 80);
  const failedOuter = await make(3, 16, JSON.stringify(failedAct), [...edge(failedAct.id, owner), ['k', '7']], 81);
  const third = await make(5, 7, '+', edge(depthNote.id, depthNote.pubkey), 90);
  const secondLink = await make(6, 16, JSON.stringify(third), [...edge(third.id, third.pubkey), ['k', '7']], 91);
  const firstLink = await make(2, 7, '⭐', edge(secondLink.id, secondLink.pubkey), 92);
  const fourEdges = await make(3, 7, '+', edge(firstLink.id, owner), 93);
  const overLink = await make(2, 7, '⭐', edge(firstLink.id, owner), 94);
  const fiveEdges = await make(3, 7, '+', edge(overLink.id, owner), 95);
  const zapRequest = await make(3, 9734, 'owned act zap', [
    ...edge(star.id, owner), ['P', seed.provider], ['amount', '21000'], ['relays', 'wss://acts.fixture.invalid/'],
  ], 598);
  const invoice = await rpc({ op: 'invoice', request: JSON.stringify(zapRequest), at: now - 1 });
  const zap = invoice.fixtureReceipt;
  const untrustedZap = await rpc({ op: 'duplicate', receipt: zap, provider: 7, at: now });
  events.push(zap, untrustedZap);
  const unsupportedAct = await make(2, 7, '⭐', edge(profiles[1].id, person), 100);
  const unsupportedOuter = await make(5, 7, '+', edge(unsupportedAct.id, owner), 101);
  const zapTargetOuter = await make(3, 7, '+', edge(zap.id, owner), 102);
  const initial = [...profiles, base, second, star, repost, directOld, directNew, directBaseRepost, directSecondRepost];
  const primary = [reactionStar, reactionStarOther, reactionRepost, repostStar, repostRepost];
  return { createdAt: now, owner, person, other, provider: seed.provider, profiles, emoji,
    base, second, star, repost, directNew, directBaseRepost, directSecondRepost, reactionStar, reactionRepost, repostStar, repostRepost,
    pendingNote, pendingAct, pendingOuter, missingId, missingAct, missingOuter,
    failedId, failedAct, failedOuter, depthNote, firstLink, fourEdges, fiveEdges, zap, untrustedZap,
    unsupportedAct, unsupportedOuter, zapTargetOuter,
    initial, stages: { primary, pending: [pendingOuter], missing: [missingOuter], failed: [failedOuter],
      depth: [fourEdges, fiveEdges], zaps: [zap, untrustedZap], unsupported: [unsupportedOuter, zapTargetOuter] },
    catalog: [...new Map([...events, ...initial].map(event => [event.id, event])).values()] };
}
