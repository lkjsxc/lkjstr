import { describe, expect, it } from 'vitest';
import type { FeedEvent } from '../../../src/lib/events/types';
import {
  eventNodeKey,
  treeNodesFromItems,
  type EventTreeListNodeCache,
} from '../../../src/lib/components/events/event-tree-list-tree';

describe('event tree list tree cache', () => {
  it('reuses flattened nodes for the same event id sequence', () => {
    const cache = emptyCache();
    const first = treeNodesFromItems([feedEvent('a'), feedEvent('b')], cache);
    const second = treeNodesFromItems([feedEvent('a'), feedEvent('b')], cache);

    expect(second).toBe(first);
    expect(second.map(eventNodeKey)).toEqual(['a', 'b']);
  });

  it('rebuilds flattened nodes when the event id sequence changes', () => {
    const cache = emptyCache();
    const first = treeNodesFromItems([feedEvent('a'), feedEvent('b')], cache);
    const second = treeNodesFromItems([feedEvent('a'), feedEvent('c')], cache);

    expect(second).not.toBe(first);
    expect(second.map(eventNodeKey)).toContain('c');
    expect(cache.key).toBe(['a', 'c'].join('\u0000'));
  });
});

function emptyCache(): EventTreeListNodeCache {
  return { key: '', nodes: [] };
}

function feedEvent(id: string): FeedEvent {
  return {
    event: {
      id,
      pubkey: 'b'.repeat(64),
      created_at: 1,
      kind: 1,
      tags: [],
      content: '',
      sig: 'c'.repeat(128),
    },
    relays: ['wss://relay.example'],
  };
}
