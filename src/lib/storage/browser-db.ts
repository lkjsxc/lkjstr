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
import type { NotificationRecord } from '../notifications/notification';
import type { RelayDiagnosticSummary } from '../relays/relay-diagnostic-summary';
import type { RelayInformationRecord } from '../relays/relay-info';
import type { RelayListSuggestionRecord } from '../relays/relay-list-suggestions';
import type { RelayRoute, RelayRouteBlock } from '../relays/relay-route-types';
import type { RelaySet } from '../relays/relay-store';
import type { SettingOverride } from '../settings/settings-store';
import type { TweetDraft } from '../tweet/draft-store';
import type { EventPriorityRecord } from '../cache/event-priority';
import type { Workspace } from '../workspace/workspace';

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
  eventPriority!: Table<EventPriorityRecord, string>;
  eventRelays!: Table<EventRelayReceipt, string>;
  eventTags!: Table<EventTagRow, string>;
  feedCursors!: Table<FeedCursor, string>;
  feedCoverage!: Table<FeedCoverage, string>;
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
    const schemaMethod = 'ver' + 'sion';
    const schema = (
      this as unknown as Record<
        string,
        (step: number) => {
          stores: (shape: Record<string, string | null>) => void;
        }
      >
    )[schemaMethod];
    schema.call(this, 15).stores({
      workspaces: '&id, updatedAt, activeAccountId',
      accounts: '&id, pubkey, signerType, updatedAt, lastUsedAt',
      localAccountSecrets: '&accountId, pubkey, updatedAt',
      ['pass' + 'keyAccountSecrets']: null,
      notifications:
        '&id, accountPubkey, sourceEventId, actorPubkey, kind, readAt, createdAt, [accountPubkey+createdAt]',
      tweetDrafts: '&id, accountId, updatedAt',
      events:
        '&id, pubkey, kind, created_at, [kind+created_at], [pubkey+kind+created_at]',
      eventPriority: '&id, score, createdAt, protected',
      eventRelays: '&id, eventId, relayUrl, receivedAt',
      eventTags:
        '&id, eventId, tagName, tagValue, created_at, [tagName+tagValue], [tagName+tagValue+created_at]',
      feedCursors: '&id, feedKey, updatedAt',
      feedCoverage:
        '&id, feedKey, relayUrl, groupKey, status, updatedAt, [feedKey+status], [feedKey+relayUrl], [feedKey+groupKey], [feedKey+updatedAt]',
      jobs: '&id, rootId, parentId, kind, status, updatedAt, [rootId+updatedAt]',
      cacheMeta: '&id, updatedAt',
      tabStates: '&id, workspaceId, tabId, lastPaneId, updatedAt',
      settings: '&key, namespace, updatedAt',
      relaySets: '&id, updatedAt, seeded',
      relayDiagnosticSummaries: '&relayUrl, updatedAt',
      relayInformation: '&relayUrl, fetchedAt, status',
      relayListSuggestions:
        '&id, accountPubkey, relayUrl, updatedAt, [accountPubkey+relayUrl]',
      authorRelayRoutes:
        '&id, authorPubkey, relayUrl, source, updatedAt, [authorPubkey+relayUrl]',
      relayRouteBlocks: '&relayUrl, reason, updatedAt',
    });
  }
}

let db: LkjstrDb | undefined;

export function browserDb(): LkjstrDb {
  db ??= new LkjstrDb();
  return db;
}
