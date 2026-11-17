import { vi } from 'vitest';
import type { FromEngine, NoteRow, Query, ToEngine } from '../src/engine/protocol.ts';
import { publicSnapshots } from '../src/engine/public-snapshots.ts';

export const query: Query = { source: 'home', account: 'a'.repeat(64), privateLists: true };
export function note(key = '1'.repeat(64), name = 'Known person'): NoteRow {
  return {
    kind: 'note',
    key,
    id: key,
    bech32: 'note1public',
    author: {
      pubkey: 'b'.repeat(64),
      npub: 'npub1public',
      name,
      profileId: 'c'.repeat(64),
      picture: 'https://images.test/public.png',
    },
    at: 1000,
    segments: [{ k: 'text', text: 'A verified public note' }],
    media: [],
    quotes: [],
    reactions: [],
    counts: {
      reactions: 7,
      replies: 2,
      reposts: 1,
      zaps: 5,
      partial: false,
      context: {
        lineage: 'fixture',
        generation: '1',
        token: 'fixture-basis',
        restored: true,
        current: true,
      },
    },
    mine: { own: false, reposted: false, bookmarked: false },
  };
}
export function harness() {
  let input: (message: FromEngine) => void = () => {};
  const post = vi.fn<(message: ToEngine, transfer?: Transferable[]) => void>();
  const messages: FromEngine[] = [];
  const transport = publicSnapshots({
    post,
    listen(fn) {
      input = fn;
    },
    close: vi.fn(),
  });
  transport.listen((message) => messages.push(message));
  const open = (next = query) => {
    transport.post({ t: 'open', sub: 'one', query: next });
    transport.post({ t: 'window', sub: 'one', anchor: 'top', before: 0, after: 60 });
  };
  const rows = (values: NoteRow[]) =>
    input({ t: 'rows', sub: 'one', rows: values, atTop: true, atBottom: false });
  return { transport, post, messages, open, rows, emit: (message: FromEngine) => input(message) };
}
export async function savePublic(values = [note()]) {
  const first = harness();
  first.open();
  first.emit({ t: 'cache.policy', sub: 'one', allow: true });
  first.rows(values);
  await vi.advanceTimersByTimeAsync(201);
  first.transport.close();
}
