import { expect, it } from 'vitest';
import { SELF } from '../src/engine/mock/people.ts';
import { noteRow } from '../src/engine/mock/rows.ts';
import { createWorld } from '../src/engine/mock/world.ts';
import { hold, unhold, withHeld } from '../src/views/held.ts';

it('mock counts use the protocol partial flag', () => {
  const world = createWorld(1_800_000_000_000);
  const note = world.notes[0];
  if (!note) throw new Error('fixture missing');
  note.partial = true;
  expect(noteRow(world, note, { me: SELF.author.pubkey }).counts.partial).toBe(true);
  note.partial = false;
  expect(noteRow(world, note, { me: SELF.author.pubkey }).counts.partial).toBe(false);
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
    expect(row.counts.reactions).toBe(0);
    expect(withHeld(row).counts.reactions).toBe(1);
    expect(withHeld(row).counts.reposts).toBe(1);
  } finally {
    unhold(row.id, reaction);
    unhold(row.id, repost);
  }
});
