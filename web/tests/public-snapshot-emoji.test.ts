import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { EmojiRow, NoteRow, Query, Row } from '../src/engine/protocol.ts';
import {
  readPublicSnapshot,
  snapshotIdentity,
  writePublicSnapshot,
} from '../src/engine/public-snapshot-store.ts';
import { harness, note } from './public-snapshots-support.ts';

const address = '30030:' + 'a'.repeat(64) + ':set';
const emoji = { code: 'pien', url: 'https://pictures.test/pien.png', address, set: 'Known set' };
const incoming: NoteRow = {
  ...note(),
  author: { ...note().author, emoji: [emoji] },
  segments: [{ k: 'emoji', ...emoji }],
  reactions: [{ emoji: ':pien:', url: emoji.url, address, set: emoji.set, count: 2, mine: false }],
  quotes: [
    {
      state: 'ok',
      id: '3'.repeat(64),
      author: note().author,
      at: 500,
      segments: [{ k: 'emoji', ...emoji }],
      media: [],
    },
  ],
};
const clients: ReturnType<typeof harness>[] = [];
function client() {
  const h = harness();
  clients.push(h);
  return h;
}
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});
afterEach(() => {
  for (const h of clients.splice(0)) h.transport.close();
  vi.clearAllTimers();
  vi.useRealTimers();
  localStorage.clear();
});

it('captures and replays distinct same-code picker sources without collapsing their keys', async () => {
  const query: Query = { source: 'emoji', account: 'b'.repeat(64) };
  const own = '10030:' + 'b'.repeat(64) + ':';
  const rows: EmojiRow[] = [own, address].map((source) => ({
    kind: 'emoji',
    key: 'emoji:' + source + ':pien:picture-hash',
    source,
    code: 'pien',
    url: emoji.url,
    set: source === own ? '' : emoji.set,
    address,
  }));
  const first = client();
  first.open(query);
  first.emit({ t: 'cache.policy', sub: 'one', allow: true });
  first.emit({ t: 'rows', sub: 'one', rows, atTop: true, atBottom: true });
  first.transport.close();
  expect(readPublicSnapshot(snapshotIdentity(query, 'en', true), 'top')?.rows).toEqual(rows);
  const cold = client();
  cold.open(query);
  await vi.advanceTimersByTimeAsync(0);
  expect(
    cold.messages.filter((message) => message.t === 'rows').map((message) => message.rows),
  ).toEqual([rows]);
});

it('requires the current source identity before a picker row can enter durable snapshots', () => {
  const incomplete = {
    kind: 'emoji',
    key: 'emoji:pien',
    set: '',
    code: 'pien',
    url: emoji.url,
  } as Row;
  writePublicSnapshot('missing-source', true, {
    rows: [incomplete],
    anchor: incomplete.key,
    atTop: true,
    atBottom: true,
  });
  expect(readPublicSnapshot('missing-source', 'top')).toBeUndefined();
});

it('keeps incoming provenance in ordinary replay while a scoped same-query visit stays transient', async () => {
  const query: Query = { source: 'their-home', pubkey: 'b'.repeat(64) };
  const first = client();
  first.open(query);
  first.emit({ t: 'cache.policy', sub: 'one', allow: true });
  first.rows([incoming]);
  first.transport.close();

  const scoped = client();
  scoped.transport.post({ t: 'open', sub: 'one', query });
  scoped.transport.post({ t: 'window', sub: 'one', anchor: { at: 1000 }, before: 0, after: 60 });
  scoped.emit({ t: 'cache.policy', sub: 'one', allow: true });
  const timed = { ...incoming, id: '9'.repeat(64), key: '9'.repeat(64), readingAt: 1000 };
  scoped.rows([timed]);
  expect(scoped.messages.at(-1)).toMatchObject({ t: 'rows', rows: [timed] });
  await vi.advanceTimersByTimeAsync(201);
  scoped.transport.close();

  const cold = client();
  cold.open(query);
  await vi.advanceTimersByTimeAsync(0);
  expect(
    cold.messages.filter((message) => message.t === 'rows').map((message) => message.rows),
  ).toEqual([[incoming]]);
});
