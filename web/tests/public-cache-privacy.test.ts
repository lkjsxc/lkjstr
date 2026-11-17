import { afterEach, expect, it, vi } from 'vitest';
import { createEngine } from '../src/engine/client.ts';
import type { FromEngine } from '../src/engine/protocol.ts';
import { rememberAccounts, rememberedAccounts } from '../src/shared/face.ts';
import { knownPerson } from '../src/shared/people.ts';
import { note } from './public-snapshots-support.ts';

afterEach(() => {
  localStorage.clear();
});
it('retains public account faces without unlocked private-list or unread evidence', () => {
  const account = {
    author: { ...note().author, muted: true },
    signer: 'local' as const,
    encrypted: true,
    locked: false,
    unread: 19,
    privateLists: { phase: 'ready' as const, pending: 0, failed: 0 },
  };
  rememberAccounts([account]);
  const raw = localStorage.getItem('lkjstr:account:faces') ?? '';
  expect(raw).not.toContain('privateLists');
  expect(raw).not.toContain('muted');
  expect(JSON.parse(raw)[0]).toMatchObject({ unread: 0, locked: true });
  // An older unsanitized record is narrowed on read as well.
  localStorage.setItem('lkjstr:account:faces', JSON.stringify([account]));
  const restored = rememberedAccounts(account.author.pubkey)[0];
  expect(restored).toMatchObject({ author: { name: 'Known person' }, unread: 0, locked: true });
  expect(restored?.privateLists).toBeUndefined();
  expect(restored?.author.muted).toBeUndefined();
  expect(localStorage.getItem('lkjstr:account:faces')).not.toContain('privateLists');
});

it('renders a private projection without retaining its authors in global suggestions', () => {
  let receive: (message: FromEngine) => void = () => {};
  const engine = createEngine({
    post: vi.fn(),
    listen(fn) {
      receive = fn;
    },
    close: vi.fn(),
  });
  const rows = vi.fn(),
    patch = vi.fn();
  const sub = engine.open({ source: 'global' }, { rows, patch });
  const person = { ...note().author, pubkey: 'e'.repeat(64), name: 'Private-derived fixture' };
  const row = { ...note(), author: person };
  try {
    receive({ t: 'cache.policy', sub: sub.id, allow: false });
    receive({ t: 'rows', sub: sub.id, rows: [row], atTop: true, atBottom: false });
    receive({ t: 'patch', sub: sub.id, ops: [{ op: 'update', row }] });
    expect(rows).toHaveBeenCalled();
    expect(patch).toHaveBeenCalled();
    expect(knownPerson(person.pubkey)).toBeUndefined();
    receive({ t: 'cache.policy', sub: sub.id, allow: true });
    receive({ t: 'rows', sub: sub.id, rows: [row], atTop: true, atBottom: false });
    expect(knownPerson(person.pubkey)?.name).toBe(person.name);
  } finally {
    sub.close();
    engine.dispose();
  }
});
