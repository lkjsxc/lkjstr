export type TabCloseReason =
  | 'retention-expired'
  | 'retention-replaced'
  | 'retention-disabled'
  | 'tab-removed'
  | 'pane-destroyed'
  | 'component-destroy';

const reasons = new Map<string, TabCloseReason>();

export function recordTabCloseReason(
  tabId: string,
  reason: TabCloseReason,
): void {
  reasons.set(tabId, reason);
}

export function consumeTabCloseReason(tabId: string): TabCloseReason {
  const reason = reasons.get(tabId) ?? 'component-destroy';
  reasons.delete(tabId);
  return reason;
}
