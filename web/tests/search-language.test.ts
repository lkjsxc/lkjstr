import { expect, it } from 'vitest';
import { SELF } from '../src/engine/mock/people.ts';
import { select } from '../src/engine/mock/query.ts';
import { timeline } from '../src/engine/mock/timeline.ts';
import { createWorld } from '../src/engine/mock/world.ts';
import type { Query } from '../src/engine/protocol.ts';

it('language arrays are a union, independent of order, duplicates and absent values', () => {
  const now = Date.UTC(2026, 10, 16, 15);
  const world = createWorld(now);
  world.notes.splice(0);
  world.byId.clear();
  const english = world.arrive(SELF, 'Hello', now - 4);
  const japanese = world.arrive(SELF, 'こんにちは', now - 3);
  const mixed = world.arrive(SELF, 'Hello こんにちは', now - 2);
  const explicit = world.arrive(SELF, '123', now - 1, { languages: ['zz'] });
  const keys = (language?: Query['language']) =>
    select(world, { source: 'global', language }, SELF.author.pubkey).map((e) => e.key);
  expect(keys(['en'])).toEqual([mixed.id, english.id]);
  expect(keys(['ja'])).toEqual([mixed.id, japanese.id]);
  expect(keys(['en', 'ja'])).toEqual([mixed.id, japanese.id, english.id]);
  expect(keys(['ja', 'en', 'ja'])).toEqual(keys(['en', 'ja']));
  expect(keys(['zz'])).toEqual([explicit.id]);
  expect(keys(['missing'])).toEqual([]);
  expect(keys([])).toEqual(keys());
  const query: Query = { source: 'global', language: ['en', 'ja'] };
  const entries = select(world, query, SELF.author.pubkey);
  const rail = timeline(query, entries, 0, entries.length, now);
  expect(rail.months.reduce((sum, month) => sum + month.count, 0)).toBe(3);
  expect(rail.positions.map((p) => p.key)).toEqual(keys(query.language));
});
