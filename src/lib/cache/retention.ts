import type { NostrEvent } from '../protocol';

export type RetentionDecision = 'keep' | 'prune';

export function eventRetention(
  event: NostrEvent,
  nowSeconds: number,
  maxAgeSeconds: number,
): RetentionDecision {
  return nowSeconds - event.created_at > maxAgeSeconds ? 'prune' : 'keep';
}

export function canPruneDrafts(): false {
  return false;
}
