import { describe, expect, it } from 'vitest';
import { createWorkspace, splitFocusedPane } from '../../../src/lib/workspace/workspace';

describe('smart split', () => {
  it('repeated split right creates one horizontal sibling group', () => {
    const one = createWorkspace();
    const two = splitFocusedPane(one, 'horizontal');
    const three = splitFocusedPane(two, 'horizontal');
    expect(three.layout?.type).toBe('split');
    if (three.layout?.type !== 'split') throw new Error('expected split');
    expect(three.layout.direction).toBe('horizontal');
    expect(three.layout.children).toHaveLength(3);
    expect(three.layout.sizes).toEqual([1 / 3, 1 / 3, 1 / 3]);
  });

  it('repeated split down creates one vertical sibling group', () => {
    const one = createWorkspace();
    const two = splitFocusedPane(one, 'vertical');
    const three = splitFocusedPane(two, 'vertical');
    expect(three.layout?.type).toBe('split');
    if (three.layout?.type !== 'split') throw new Error('expected split');
    expect(three.layout.direction).toBe('vertical');
    expect(three.layout.children).toHaveLength(3);
  });

  it('direction changes wrap only the target pane', () => {
    const horizontal = splitFocusedPane(createWorkspace(), 'horizontal');
    const mixed = splitFocusedPane(horizontal, 'vertical');
    expect(mixed.layout?.type).toBe('split');
    if (mixed.layout?.type !== 'split') throw new Error('expected split');
    expect(mixed.layout.direction).toBe('horizontal');
    expect(mixed.layout.children).toHaveLength(2);
    expect(mixed.layout.children[1]?.type).toBe('split');
    const nested = mixed.layout.children[1];
    if (nested?.type !== 'split') throw new Error('expected nested split');
    expect(nested.direction).toBe('vertical');
    expect(nested.children).toHaveLength(2);
  });
});
