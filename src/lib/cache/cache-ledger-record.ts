export type CacheOwnerKind =
  | 'event'
  | 'notification'
  | 'feed-page'
  | 'feed-coverage'
  | 'feed-scan-hint'
  | 'tab-snapshot'
  | 'relay-diagnostic'
  | 'relay-information'
  | 'relay-suggestion'
  | 'route-evidence'
  | 'job';

export type CacheResourceKind =
  | 'nostr-event'
  | 'notification-record'
  | 'feed-cursor'
  | 'coverage-row'
  | 'scan-hint'
  | 'tab-state'
  | 'relay-summary'
  | 'relay-info'
  | 'relay-list-suggestion'
  | 'author-relay-route'
  | 'relay-route-block'
  | 'job-record';

export type CacheLedgerRecord = {
  readonly id: string;
  readonly ownerKind: CacheOwnerKind;
  readonly resourceKind: CacheResourceKind;
  readonly resourceId: string;
  readonly score: number;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly cacheBytes: number;
  readonly protected: boolean;
  readonly accountPubkey?: string;
  readonly feedKey?: string;
  readonly relayUrl?: string;
  readonly reason?: string;
};

export function isCacheLedgerProtected(row: CacheLedgerRecord): boolean {
  return row.protected;
}
