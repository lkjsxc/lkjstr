import { describe, expect, it } from 'vitest';
import { tabStateId } from '../../../src/lib/workspace/tab-states-store';

describe('tabStateId', () => {
  it('uses workspace and tab identity without pane placement', () => {
    expect(tabStateId('workspace', 'tab')).toBe('workspace:tab');
  });
});
