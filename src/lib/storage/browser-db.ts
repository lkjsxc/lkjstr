import Dexie, { type Table } from 'dexie';
import type { Account } from '../accounts/account';
import type { LocalAccountSecret } from '../accounts/local-secret-store';
import type { CacheMetadata } from '../cache/cache-status';
import type {
  EventRelayReceipt,
  EventTagRow,
  FeedCoverage,
  FeedCursor,
  JobRecord,
  StoredEvent,
} from '../events/types';
import type { FeedScanHint } from '../events/feed-scan-hints';
import type { NotificationRecord } from '../notifications/notification';
import type { RelayDiagnosticSummary } from '../relays/relay-diagnostic-summary';
import type { RelayInformationRecord } from '../relays/relay-info';
import type { RelayListSuggestionRecord } from '../relays/relay-list-suggestions';
import type { RelayRoute, RelayRouteBlock } from '../relays/relay-route-types';
import type { RelaySet } from '../relays/relay-store';
import type { SettingOverride } from '../settings/settings-store';
import type { TweetDraft } from '../tweet/draft-store';
import type { CacheLedgerRecord } from '../cache/cache-ledger-record';
import type { Workspace } from '../workspace/workspace';
import {
  currentStorageSchemaStep,
  dexieStoreShape,
} from './schema/dexie-schema';

export type TabStateRecord = {
  readonly id: string;
  readonly workspaceId: string;
  readonly tabId: string;
  readonly lastPaneId?: string;
  readonly state: unknown;
  readonly updatedAt: number;
};

export class LkjstrDb extends Dexie {
  workspaces!: Table<Workspace, string>;
  accounts!: Table<Account, string>;
  localAccountSecrets!: Table<LocalAccountSecret, string>;
  notifications!: Table<NotificationRecord, string>;
  tweetDrafts!: Table<TweetDraft, string>;
  events!: Table<StoredEvent, string>;
  cacheLedger!: Table<CacheLedgerRecord, string>;
  eventRelays!: Table<EventRelayReceipt, string>;
  eventTags!: Table<EventTagRow, string>;
  feedCursors!: Table<FeedCursor, string>;
  feedCoverage!: Table<FeedCoverage, string>;
  feedScanHints!: Table<FeedScanHint, string>;
  jobs!: Table<JobRecord, string>;
  cacheMeta!: Table<CacheMetadata, string>;
  tabStates!: Table<TabStateRecord, string>;
  settings!: Table<SettingOverride, string>;
  relaySets!: Table<RelaySet, string>;
  relayDiagnosticSummaries!: Table<RelayDiagnosticSummary, string>;
  relayInformation!: Table<RelayInformationRecord, string>;
  relayListSuggestions!: Table<RelayListSuggestionRecord, string>;
  authorRelayRoutes!: Table<RelayRoute, string>;
  relayRouteBlocks!: Table<RelayRouteBlock, string>;

  constructor() {
    super('lkjstr');
    this.version(currentStorageSchemaStep).stores(dexieStoreShape());
  }
}

let db: LkjstrDb | undefined;

export function browserDb(): LkjstrDb {
  db ??= new LkjstrDb();
  return db;
}
