import { tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import type { FlatEventTreeItem } from '../../../src/lib/events/tree';
import {
  syncFeedListAnchor,
  type EventAnchorRow,
} from '../../../src/lib/components/events/event-tree-list-anchors';

const node = (id: string) => ({ event: { id }, depth: 0 }) as FlatEventTreeItem;

const row = (id: string, visualIndex: number): EventAnchorRow => ({
  node: node(id),
  visualIndex,
});

describe('event tree list anchors', () => {
  it('captures and restores event anchors by visual row index', async () => {
    const scrollTo = vi.fn();
    syncFeedListAnchor({
      previous: [row('a', 1), row('b', 2)],
      rows: [row('x', 1), row('a', 2), row('b', 3)],
      key: (item) => item.event.id,
      destroyed: () => false,
      list: {
        getScrollOffset: () => 225,
        getItemOffset: (index) => index * 100,
        scrollTo,
      },
    });
    await tick();
    expect(scrollTo).toHaveBeenCalledWith(325);
  });

  it('keeps a top-locked list at offset zero for live prepends', async () => {
    const scrollTo = vi.fn();
    syncFeedListAnchor({
      previous: [row('a', 0), row('b', 1)],
      rows: [row('x', 0), row('a', 1), row('b', 2)],
      key: (item) => item.event.id,
      destroyed: () => false,
      list: {
        getScrollOffset: () => 0,
        getItemOffset: (index) => index * 100,
        scrollTo,
      },
    });
    await tick();
    expect(scrollTo).toHaveBeenCalledWith(0);
  });
});
