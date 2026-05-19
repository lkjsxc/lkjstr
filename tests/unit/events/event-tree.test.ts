import { describe, expect, it } from 'vitest';
import { buildEventTree } from '../../../src/lib/events/tree';
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
