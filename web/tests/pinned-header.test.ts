import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createMockEngine, type MockEngine } from '../src/engine/mock/engine.ts';
import { byHandle } from '../src/engine/mock/people.ts';
import { createWorld } from '../src/engine/mock/world.ts';
import type { FromEngine, Query } from '../src/engine/protocol.ts';

const NOW = Date.UTC(2026, 10, 17, 5, 0, 0);
let output: FromEngine[] = [];
let engine: MockEngine;
const rows = (): Extract<FromEngine, { t: 'rows' }> =>
  output.filter((item): item is Extract<FromEngine, { t: 'rows' }> => item.t === 'rows').at(-1)!;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  output = [];
  engine = createMockEngine((message) => output.push(structuredClone(message)));
  engine.handle({
    t: 'configure',
    config: {
      language: 'en',
      heuristics: true,
      prefetch: true,
      mock: { live: false },
    },
  });
});
afterEach(() => {
  engine.dispose();
  vi.useRealTimers();
});

it.each([
  ['profile', { source: 'profile', pubkey: byHandle('aoi').author.pubkey }],
  ['channel', { source: 'channel', id: createWorld(NOW).state.channels[0]!.id }],
] as const)('%s keeps its structural header outside a note window', (source, query) => {
  engine.handle({ t: 'open', sub: 'p', query: query as Query });
  engine.handle({ t: 'window', sub: 'p', anchor: 'top', before: 0, after: 100 });
  const note = rows().rows.find((item) => item.kind === 'note');
  expect(note).toBeDefined();
  engine.handle({ t: 'window', sub: 'p', anchor: { key: note!.key }, before: 0, after: 1 });
  expect(rows().rows.map((item) => item.kind)).toEqual([source, 'note']);
  expect(rows().rows[1]?.key).toBe(note?.key);
  expect(rows().atTop).toBe(true);
  engine.handle({ t: 'window', sub: 'p', anchor: { key: note!.key }, before: 0, after: 0 });
  expect(rows().rows.map((item) => item.kind)).toEqual([source]);
});
