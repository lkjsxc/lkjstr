import type { CacheOwnerKind } from './cache-ledger-record';

export function cacheLedgerId(
  ownerKind: CacheOwnerKind,
  resourceId: string,
): string {
  return `${ownerKind}:${resourceId}`;
}
