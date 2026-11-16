import { afterEach, beforeEach, expect, it } from 'vitest';
import { createDmStream } from '../src/views/dm-stream.ts';
import { dmEnv, message, OTHER, ROOM } from './dm-ui-fixture.ts';
import { PUBKEY, tick } from './vault-ui-fixture.ts';

beforeEach(() => localStorage.clear());
afterEach(() => document.body.replaceChildren());
it('does not request hidden private history and clears an empty-head wait when rows arrive', async () => {
  const x = dmEnv(),
    stream = createDmStream({ env: x.env, account: PUBKEY, peers: [OTHER], changed() {} });
  try {
    await tick();
    expect(x.sent.find((m) => m.t === 'dm.open')).toMatchObject({
      query: { participants: [OTHER], limit: 100 },
    });
    x.answer({ conversation: ROOM, more: true });
    x.visible.set(false);
    stream.more();
    expect(x.sent.some((m) => m.t === 'dm.more')).toBe(false);
    expect(stream.loading()).toBe(false);
    x.visible.set(true);
    stream.more();
    expect(stream.loading()).toBe(true);
    x.answer({ conversation: ROOM, messages: [message()], more: true });
    expect(stream.loading()).toBe(false);
    stream.more();
    expect(x.sent.filter((m) => m.t === 'dm.open').at(-1)).toMatchObject({
      query: { before: message().id, limit: 100 },
    });
  } finally {
    stream.dispose();
    x.dispose();
  }
});
it('acknowledges cached history from the Seen request without marking newer arrivals read', async () => {
  const x = dmEnv(),
    stream = createDmStream({ env: x.env, account: PUBKEY, peers: [OTHER], changed() {} });
  try {
    await tick();
    const head = x.sent.find((m) => m.t === 'dm.open');
    if (head?.t !== 'dm.open') throw new Error('missing private head');
    x.answer({ conversation: ROOM, messages: [message({ at: 1000 })], more: true }, head.sub);
    stream.more();
    const old = message({ id: 'e'.repeat(64), at: 500 });
    x.answer({ conversation: ROOM, messages: [old] });
    const acknowledged = stream.rows().map((row) => row.id);
    const incoming = message({ id: 'f'.repeat(64), at: 2000 });
    x.answer(
      { conversation: ROOM, messages: [incoming, message({ at: 1000 })], more: true },
      head.sub,
    );
    stream.ackSeen(acknowledged);
    expect(stream.known(old.id)?.unread).toBe(false);
    expect(stream.known(message().id)?.unread).toBe(false);
    expect(stream.known(incoming.id)?.unread).toBe(true);
  } finally {
    stream.dispose();
    x.dispose();
  }
});
