import { describe, expect, it } from 'vitest';
import { buildEventTree, flattenEventTree } from '../../../src/lib/events/tree';
import type { NostrEvent } from '../../../src/lib/protocol';

describe('event tree', () => {
  it('sorts roots and children newest first and keeps orphans as roots', () => {
    const root = event('a', 10);
    const child = event('b', 12, [['e', root.id, '', 'reply']]);
    const orphan = event('c', 14, [['e', 'missing', '', 'reply']]);

    const tree = buildEventTree(
      [child, root, orphan].map((item) => ({
        event: item,
        relays: ['cache'],
      })),
    );

    expect(tree.map((item) => item.event.id)).toEqual([orphan.id, root.id]);
    expect(tree[1]?.children.map((item) => item.event.id)).toEqual([child.id]);
  });

  it('collapses branches beyond the configured depth', () => {
    const items = ['a', 'b', 'c', 'd'].map((seed, index) =>
      event(
        seed,
        20 - index,
        index ? [['e', previous(seed), '', 'reply']] : [],
      ),
    );
    const flat = flattenEventTree(
      buildEventTree(items.map((item) => ({ event: item, relays: ['cache'] }))),
      1,
    );

    expect(flat.map((item) => item.event.id)).toEqual([
      items[0]!.id,
      items[1]!.id,
      items[2]!.id,
    ]);
    expect('collapsed' in flat[2]!).toBe(true);
  });
});

function event(
  seed: string,
  created_at: number,
  tags: string[][] = [],
): NostrEvent {
  return {
    id: seed.repeat(64).slice(0, 64),
    pubkey: 'f'.repeat(64),
    created_at,
    kind: 1,
    tags,
    content: seed,
    sig: 'e'.repeat(128),
  };
}

function previous(seed: string): string {
  return String.fromCharCode(seed.charCodeAt(0) - 1)
    .repeat(64)
    .slice(0, 64);
}
