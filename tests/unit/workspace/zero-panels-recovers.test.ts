import { describe, expect, it } from 'vitest';
import { closeWorkspacePane } from '../../../src/lib/workspace/pane-commands';
import {
  createEmptyWorkspace,
  ensureUsableWorkspace,
} from '../../../src/lib/workspace/workspace';

describe('zero-panel recovery', () => {
  it('recovers a stale zero-pane workspace to one timeline tile', () => {
    const stale = createEmptyWorkspace();
    const recovered = ensureUsableWorkspace(stale);
    expect(recovered.layout?.type).toBe('pane');
    expect(Object.values(recovered.tabs)[0]?.kind).toBe('timeline');
    expect(recovered.focusedPaneId).toBe(recovered.layout?.id);
    expect(recovered.focusedTabId).toBe(Object.keys(recovered.tabs)[0]);
  });

  it('closing the final pane creates a recovery timeline tile', () => {
    const recovered = ensureUsableWorkspace(createEmptyWorkspace());
    if (!recovered.focusedPaneId) throw new Error('expected pane');
    const closed = closeWorkspacePane(recovered, recovered.focusedPaneId);
    expect(closed.layout?.type).toBe('pane');
    expect(Object.values(closed.tabs)[0]?.kind).toBe('timeline');
    expect(Object.keys(closed.tabGroups)).toHaveLength(1);
  });
});
