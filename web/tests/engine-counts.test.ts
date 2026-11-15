import { expect, it } from 'vitest';
import { SELF } from '../src/engine/mock/people.ts';
import { noteRow } from '../src/engine/mock/rows.ts';
import { createWorld } from '../src/engine/mock/world.ts';
import { hold, unhold, withHeld } from '../src/views/held.ts';

it('mock counts distinguish unknown, lower bounds and exact zero', () => {
  const world = createWorld(1_800_000_000_000);
  const note = world.notes[0];
  if (!note) throw new Error('fixture missing');
  note.partial = true;
  note.zaps = 0;
  expect(noteRow(world, note, { me: SELF.author.pubkey }).counts).toMatchObject({
    zaps: 0,
    estimates: { zaps: { state: 'unknown' } },
  });
  note.zaps = 12;
  expect(noteRow(world, note, { me: SELF.author.pubkey }).counts.estimates?.zaps).toEqual({
    state: 'at-least',
    value: 12,
  });
  note.partial = false;
  note.zaps = 0;
  expect(noteRow(world, note, { me: SELF.author.pubkey }).counts).toMatchObject({
    zaps: 0,
    estimates: { zaps: { state: 'exact', value: 0 } },
  });
});

it('unknown legacy counts start optimistic reactions and reposts at one', () => {
  const world = createWorld(1_800_000_000_000);
  const note = world.notes[0];
  if (!note) throw new Error('fixture missing');
  note.partial = true;
  note.reactions.clear();
  note.reposts = [];
  note.mineReposted = false;
  const row = noteRow(world, note, { me: SELF.author.pubkey });
  const act = () => Promise.resolve({ ok: true } as never);
  const reaction = { k: 'reaction', emoji: '+' } as const;
  const repost = { k: 'repost' } as const;
  hold(row.id, SELF.author.pubkey, reaction, act, () => undefined);
  hold(row.id, SELF.author.pubkey, repost, act, () => undefined);
  try {
    expect(row.counts.estimates?.reactions).toEqual({ state: 'unknown' });
    expect(withHeld(row).counts.reactions).toBe(1);
    expect(withHeld(row).counts.reposts).toBe(1);
  } finally {
    unhold(row.id, reaction);
    unhold(row.id, repost);
  }
});
