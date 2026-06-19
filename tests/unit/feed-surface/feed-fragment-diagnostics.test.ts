import { describe, expect, it } from 'vitest';
import type { FlatEventTreeItem } from '../../../src/lib/events/tree';
import {
  feedFragmentDiagnostics,
  recordFeedFragmentMounted,
  recordFeedFragmentUnmounted,
} from '../../../src/lib/feed-surface/feed-fragment-diagnostics';
import { planEventVisualFragments } from '../../../src/lib/feed-surface/feed-visual-fragments';

describe('feed fragment diagnostics', () => {
  it('tracks visible fragments and oversized semantic rows as counts', () => {
    const before = feedFragmentDiagnostics();

    recordFeedFragmentMounted();
    expect(feedFragmentDiagnostics().visibleFragments).toBe(
      before.visibleFragments + 1,
    );
    recordFeedFragmentUnmounted();
    expect(feedFragmentDiagnostics().visibleFragments).toBe(
      before.visibleFragments,
    );

    const fragments = planEventVisualFragments(
      realItem('e'.repeat(64), 'alpha beta\n\n'.repeat(260)),
    );
    const after = feedFragmentDiagnostics();
    expect(fragments.length).toBeGreaterThan(1);
    expect(after.oversizedSemanticRows).toBeGreaterThan(
      before.oversizedSemanticRows,
    );
  });
});

function realItem(id: string, content: string): FlatEventTreeItem {
  return {
    event: {
      id,
      pubkey: 'b'.repeat(64),
      created_at: 1,
      kind: 1,
      tags: [],
      content,
      sig: 'c'.repeat(128),
    },
    relays: ['wss://relay.example'],
    children: [],
    depth: 0,
  } as FlatEventTreeItem;
}
