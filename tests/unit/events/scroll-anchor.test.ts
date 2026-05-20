import { describe, expect, it, vi } from 'vitest';
import {
  captureVirtualAnchor,
  compensateHeightDelta,
  restoreVirtualAnchor,
} from '../../../src/lib/events/scroll-anchor';

describe('scroll anchors', () => {
  it('captures and restores virtual list offsets by stable key', () => {
    const oldItems = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const nextItems = [{ id: 'x' }, { id: 'a' }, { id: 'b' }, { id: 'c' }];
    const scrollTo = vi.fn();
    const anchor = captureVirtualAnchor(oldItems, (item) => item.id, {
      getOffset: () => 125,
      getItemOffset: (index) => index * 100,
    });
    restoreVirtualAnchor(anchor, nextItems, (item) => item.id, {
      getItemOffset: (index) => index * 100,
      scrollTo,
    });
    expect(anchor).toEqual({ key: 'b', offset: 25 });
    expect(scrollTo).toHaveBeenCalledWith(225);
  });

  it('compensates height changes above the visible anchor', () => {
    const container = { scrollTop: 200 } as HTMLElement;
    const node = { offsetTop: 100 } as HTMLElement;
    compensateHeightDelta(container, node, 80, 120);
    expect(container.scrollTop).toBe(240);
  });
});
