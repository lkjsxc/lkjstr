import { kinds, type NostrEvent } from '../protocol';

export const actionCacheChangedEvent = 'lkjstr-action-cache-changed';

export function isActionKind(kind: number): boolean {
  return (
    kind === kinds.reaction ||
    kind === kinds.repost ||
    kind === kinds.genericRepost
  );
}

export function notifyActionCacheChanged(event: NostrEvent): void {
  if (typeof window === 'undefined' || !isActionKind(event.kind)) return;
  window.dispatchEvent(
    new CustomEvent(actionCacheChangedEvent, { detail: event }),
  );
}
