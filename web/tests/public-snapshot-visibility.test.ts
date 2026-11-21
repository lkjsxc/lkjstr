import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { NoteRow } from '../src/engine/protocol.ts';
import { mergePublicRow } from '../src/engine/public-snapshot-model.ts';
import { readPublicSnapshot, snapshotIdentity } from '../src/engine/public-snapshot-store.ts';
import { harness, note, query, savePublic } from './public-snapshots-support.ts';

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

it('replaces a cached body with the covered slot and does not carry old previews', async () => {
  const original: NoteRow = {
    ...note(),
    previews: [{ source: 'https://example.test', url: 'https://example.test', kind: 'page' }],
  };
  const covered: NoteRow = {
    ...note(),
    segments: [],
    hidden: { reason: 'muted-word', revealable: true, detail: 'fixture' },
  };
  expect(mergePublicRow(original, covered)).toEqual(covered);
  await savePublic();
  const h = harness();
  h.open();
  h.emit({ t: 'cache.policy', sub: 'one', allow: true });
  h.rows([covered]);
  await vi.advanceTimersByTimeAsync(250);
  expect(readPublicSnapshot(snapshotIdentity(query, 'en', true), 'top')).toBeUndefined();
  h.transport.close();
});

it.each([{ revealed: { reason: 'muted-person' } }, { expiresAt: 1_000_000 }])(
  'does not persist a revealed or expiring body',
  async (extra) => {
    const h = harness();
    h.open();
    h.emit({ t: 'cache.policy', sub: 'one', allow: true });
    h.rows([{ ...note(), ...extra }]);
    await vi.advanceTimersByTimeAsync(250);
    expect(readPublicSnapshot(snapshotIdentity(query, 'en', true), 'top')).toBeUndefined();
    h.transport.close();
  },
);
