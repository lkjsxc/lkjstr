import { expect, it } from 'vitest';
import { notifications } from '../src/engine/mock/lists.ts';
import { byHandle, SELF } from '../src/engine/mock/people.ts';
import { select } from '../src/engine/mock/query.ts';
import { noteRow } from '../src/engine/mock/rows.ts';
import { createWorld } from '../src/engine/mock/world.ts';
import type { NoteRow } from '../src/engine/protocol.ts';

const NOW = 1794000000000;
it('answers all A1 chain states and filters by the newest act type', () => {
  const w = createWorld(NOW);
  const q = { source: 'notifications', account: SELF.author.pubkey } as const;
  const rows = notifications(w, q);
  const chains = rows.filter((row) => row.target?.act || row.pendingAct);
  expect(chains).toHaveLength(4);
  expect(
    chains
      .map((row) => row.pendingAct?.state)
      .filter(Boolean)
      .sort(),
  ).toEqual(['loading', 'missing']);
  const reaction = chains.find((row) => row.type === 'reaction' && row.target?.act);
  expect(reaction?.actors).toHaveLength(2);
  expect(reaction?.emoji?.url).toBeTruthy();
  expect(reaction?.target?.act?.emoji?.emoji).toBe('⭐');
  const filtered = notifications(w, { ...q, types: ['reaction'] });
  expect(filtered.every((row) => row.type === 'reaction')).toBe(true);
  expect(filtered.some((row) => row.target?.act?.type === 'repost')).toBe(true);
  expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
});

it('projects profile act chains once at their own time without mutating terminal-note counts', () => {
  const w = createWorld(NOW);
  const rows = select(
    w,
    {
      source: 'profile',
      pubkey: byHandle('aoi').author.pubkey,
      show: 'reactions',
    },
    SELF.author.pubkey,
  ).map((entry) => entry.row());
  const notes = rows.filter((row): row is NoteRow => row.kind === 'note');
  expect(notes.slice(0, 3).map((row) => row.actOn?.type)).toEqual([
    undefined,
    'reaction',
    'repost',
  ]);
  expect(notes.slice(0, 3).map((row) => row.at)).toEqual([
    w.base - 3 * 60000,
    w.base - 4 * 60000,
    w.base - 5 * 60000,
  ]);
  expect(new Set(notes.map((row) => row.id)).size).toBe(notes.length);
  for (const row of notes.slice(0, 3)) {
    const n = w.byId.get(row.id)!;
    const original = noteRow(w, n, { me: SELF.author.pubkey });
    expect(row.counts).toEqual(original.counts);
    expect(row.reactions).toEqual(original.reactions);
    expect(row.mine).toEqual(original.mine);
  }
});

it('does not add acts or act context to Home, lists or search', () => {
  const w = createWorld(NOW);
  for (const query of [
    { source: 'home' as const },
    { source: 'list' as const, tag: 'photographers' },
    { source: 'search' as const, text: 'the' },
  ]) {
    const rows = select(w, query, SELF.author.pubkey).map((entry) => entry.row());
    expect(rows.filter((row) => row.kind === 'note').every((row) => !row.act && !row.actOn)).toBe(
      true,
    );
  }
});
