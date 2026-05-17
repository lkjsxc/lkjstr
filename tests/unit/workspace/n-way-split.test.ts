import { describe, expect, it } from 'vitest';
import { splitPaneInto } from '../../../src/lib/workspace/n-way-split';
import { createWorkspace } from '../../../src/lib/workspace/workspace';

describe('N-way split', () => {
  it('splits one pane into three columns', () => {
    const workspace = createWorkspace();
    const split = splitPaneInto(
      workspace,
      workspace.focusedPaneId ?? '',
      'horizontal',
      3,
    );
    expect(split.layout?.type).toBe('split');
    if (split.layout?.type !== 'split') throw new Error('expected split');
    expect(split.layout.children).toHaveLength(3);
    expect(split.layout.sizes).toEqual([1 / 3, 1 / 3, 1 / 3]);
  });

  it('splits one pane into five rows', () => {
    const workspace = createWorkspace();
    const split = splitPaneInto(
      workspace,
      workspace.focusedPaneId ?? '',
      'vertical',
      5,
    );
    expect(split.layout?.type).toBe('split');
    if (split.layout?.type !== 'split') throw new Error('expected split');
    expect(split.layout.children).toHaveLength(5);
    expect(split.layout.direction).toBe('vertical');
  });
});
