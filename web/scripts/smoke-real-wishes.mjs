import { wishes } from './smoke-wishes.mjs';

export async function runRealWishes({
  browser,
  base,
  fixture,
  fixtureSign,
  fake,
  relayUrl,
  errors,
  check,
}) {
  const actor = await fixtureSign({ fixtureActor: true });
  fake.add(actor);
  let wishAt = Math.floor(Date.now() / 1000);
  const wishVersions = new Map();
  const addWish = async (kind, content, tags = [], as = actor.pubkey) => {
    const event = await fixtureSign({
      pubkey: as,
      created_at:
        kind === 0 || kind === 3
          ? (() => {
              const key = `${as}:${kind}`;
              const at = Math.max(Math.floor(Date.now() / 1000), (wishVersions.get(key) ?? 0) + 1);
              wishVersions.set(key, at);
              return at;
            })()
          : Math.floor(Date.now() / 1000),
      kind,
      content,
      tags,
    });
    fake.add(event);
    return event;
  };
  // Enough honest notification targets for scrolling, using a distinct signed actor.
  for (let i = 0; i < 18; i++) {
    const target = await addWish(1, `wish target ${i}`, [], fixture.note.pubkey);
    await addWish(7, '+', [
      ['e', target.id],
      ['p', fixture.note.pubkey],
    ]);
  }
  const wishEvents = async ({ kind, target, author }) => {
    wishAt++;
    if (kind === 'mentionSent') {
      const matches = () =>
        fake.published.some(
          (e) =>
            e.kind === 1 &&
            e.content.includes(`nostr:${author.npub}`) &&
            e.content.includes('wish queued note') &&
            !e.content.includes('@engine') &&
            e.tags.some((tag) => tag[0] === 'p' && tag[1] === author.pubkey),
        );
      for (let i = 0; i < 200 && !matches(); i++) await new Promise((done) => setTimeout(done, 25));
      return matches();
    }
    if (kind === 'face') {
      const picture = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36'%3E%3Crect width='36' height='36' fill='purple'/%3E%3C/svg%3E`;
      await addWish(
        0,
        JSON.stringify({ name: 'engine-fixture', picture }),
        [],
        fixture.note.pubkey,
      );
      return picture;
    }
    if (kind === 'arrival')
      return addWish(1, `Engine wish arrival ${wishAt}`, [], fixture.note.pubkey);
    if (kind === 'reactions') {
      for (const content of ['+', '', '❤️', '-'])
        await addWish(7, content, [
          ['e', target.id],
          ['p', target.author.pubkey],
        ]);
    }
    if (kind === 'notifications') {
      const target = await addWish(1, `wish new target ${wishAt}`, [], fixture.note.pubkey);
      for (const content of ['+', '', '❤️'])
        await addWish(7, content, [
          ['e', target.id],
          ['p', fixture.note.pubkey],
        ]);
    }
  };
  await wishes({
    browser,
    base,
    real: true,
    sign: fixtureSign,
    relayUrl,
    pubkey: fixture.note.pubkey,
    fake,
    events: wishEvents,
    errors,
    check,
  });
  // The field regression intentionally publishes an owner relay edit. Restore
  // the shared fixture before independent account/bootstrap scenarios begin.
  fake.add(
    await fixtureSign({
      pubkey: fixture.note.pubkey,
      created_at: Math.floor(Date.now() / 1000) + 1,
      kind: 10002,
      tags: [['r', `${relayUrl}/owner`]],
      content: '',
    }),
  );
  return { actor, addWish };
}
