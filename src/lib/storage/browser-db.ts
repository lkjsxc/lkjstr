import Dexie, { type Table } from 'dexie';
import type { Account } from '../accounts/account';
import type { LocalAccountSecret } from '../accounts/local-secret-store';
import type { CacheMetadata } from '../cache/cache-status';
import type { CacheLedgerRecord } from '../cache/cache-ledger-record';
import type { FeedScanHint } from '../events/feed-scan-hints';
import type {
  EventRelayReceipt,
  EventTagRow,
  FeedCoverage,
  FeedCursor,
  JobRecord,
  StoredEvent,
} from '../events/types';
import type { NotificationRecord } from '../notifications/notification';
import type { RelayDiagnosticSummary } from '../relays/relay-diagnostic-summary';
import type { RelayInformationRecord } from '../relays/relay-info';
import type { RelayListSuggestionRecord } from '../relays/relay-list-suggestions';
import type { RelayRoute, RelayRouteBlock } from '../relays/relay-route-types';
import type { RelaySet } from '../relays/relay-store';
import type { SettingOverride } from '../settings/settings-store';
import type { TabStateRecord } from './tab-state-record';
import type { TweetDraft } from '../tweet/draft-store';
import type { Workspace } from '../workspace/workspace';
import {
  currentStorageSchemaStep,
  dexieStoreShape,
} from './schema/dexie-schema';

export type LkjstrDb = Dexie & {
  readonly workspaces: Table<Workspace, string>;
  readonly accounts: Table<Account, string>;
  readonly localAccountSecrets: Table<LocalAccountSecret, string>;
  readonly notifications: Table<NotificationRecord, string>;
  readonly tweetDrafts: Table<TweetDraft, string>;
  readonly events: Table<StoredEvent, string>;
  readonly cacheLedger: Table<CacheLedgerRecord, string>;
  readonly eventRelays: Table<EventRelayReceipt, string>;
  readonly eventTags: Table<EventTagRow, string>;
  readonly feedCursors: Table<FeedCursor, string>;
  readonly feedCoverage: Table<FeedCoverage, string>;
  readonly feedScanHints: Table<FeedScanHint, string>;
  readonly jobs: Table<JobRecord, string>;
  readonly cacheMeta: Table<CacheMetadata, string>;
  readonly tabStates: Table<TabStateRecord, string>;
  readonly settings: Table<SettingOverride, string>;
  readonly relaySets: Table<RelaySet, string>;
  readonly relayDiagnosticSummaries: Table<RelayDiagnosticSummary, string>;
  readonly relayInformation: Table<RelayInformationRecord, string>;
  readonly relayListSuggestions: Table<RelayListSuggestionRecord, string>;
  readonly authorRelayRoutes: Table<RelayRoute, string>;
  readonly relayRouteBlocks: Table<RelayRouteBlock, string>;
};

let db: LkjstrDb | undefined;

export function browserDb(): LkjstrDb {
  db ??= createBrowserDb();
  return db;
}

function createBrowserDb(): LkjstrDb {
  const next = new Dexie('lkjstr') as LkjstrDb;
  next.version(currentStorageSchemaStep).stores(dexieStoreShape());
  return next;
}
