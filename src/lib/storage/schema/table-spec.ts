import type { CacheResourceKind } from '../../cache/cache-ledger-record';

export type StorageDataClass =
  | 'protected-user-data'
  | 'protected-safety-configuration'
  | 'recoverable-cache'
  | 'derived-feed-cache'
  | 'diagnostics-cache'
  | 'ledger'
  | 'metadata';

export type StorageInventoryGroup =
  | 'protected'
  | 'protected-safety'
  | 'prunable-cache'
  | 'derived-page-cache'
  | 'diagnostics'
  | 'ledger'
  | 'metadata';

export type StorageTableName =
  | 'workspaces'
  | 'accounts'
  | 'localAccountSecrets'
  | 'notifications'
  | 'tweetDrafts'
  | 'events'
  | 'cacheLedger'
  | 'eventRelays'
  | 'eventTags'
  | 'feedCursors'
  | 'feedCoverage'
  | 'feedScanHints'
  | 'jobs'
  | 'cacheMeta'
  | 'tabStates'
  | 'settings'
  | 'relaySets'
  | 'relayDiagnosticSummaries'
  | 'relayInformation'
  | 'relayListSuggestions'
  | 'authorRelayRoutes'
  | 'relayRouteBlocks';

export type StorageTableSpec = {
  readonly name: StorageTableName;
  readonly dataClass: StorageDataClass;
  readonly inventoryGroup: StorageInventoryGroup;
  readonly primaryOwner: string;
  readonly ledgerResourceKind?: CacheResourceKind;
  readonly protectedByDefault: boolean;
  readonly repairable: boolean;
  readonly compactable: boolean;
};
