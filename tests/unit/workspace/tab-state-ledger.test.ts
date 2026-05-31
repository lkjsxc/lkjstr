import { describe, expect, it } from 'vitest';
import { tabStateLedgerRecord } from '../../../src/lib/workspace/tab-state-ledger';
import { tabStateId } from '../../../src/lib/workspace/tab-states-store';

describe('tabStateLedgerRecord', () => {
  it('registers durable tab snapshots as tab-state ledger rows', () => {
    const id = tabStateId('workspace', 'tab');
    expect(
      tabStateLedgerRecord({
        id,
        workspaceId: 'workspace',
        tabId: 'tab',
        lastPaneId: 'pane',
        state: { kind: 'tool', scrollTop: 12 },
        updatedAt: 3_600_000,
      }),
    ).toMatchObject({
      id: `tab-snapshot:${id}`,
      ownerKind: 'tab-snapshot',
      resourceKind: 'tab-state',
      resourceId: id,
      score: 51,
      protected: false,
      reason: 'tab-snapshot',
    });
  });
});
