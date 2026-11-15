import { expect, it } from 'vitest';
import { SELF } from '../src/engine/mock/people.ts';
import { noteRow } from '../src/engine/mock/rows.ts';
import { createWorld } from '../src/engine/mock/world.ts';

it('mock counts distinguish unknown, lower bounds and exact zero', () => {
  const world = createWorld(1_800_000_000_000);
  const note = world.notes[0];
  if (!note) throw new Error('fixture missing');
  note.partial = true;
  note.zaps = 0;
  expect(noteRow(world, note, { me: SELF.author.pubkey }).counts).toMatchObject({
    zaps: -1,
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
