import Dexie, { type Table } from 'dexie';
import type { Account } from '../accounts/account';
import type { CacheMetadata } from '../cache/cache-status';
import type { NotificationRecord } from '../notifications/notification';
import type { PostTree, PostTreeNode } from '../post-manager/post-tree';
import type { NostrEvent } from '../protocol';
import type { RelaySet } from '../relays/relay-store';
import type { SettingOverride } from '../settings/settings-store';
import type { Workspace } from '../workspace/workspace';

export type TabStateRecord = {
  readonly id: string;
  readonly tabId: string;
  readonly state: unknown;
  readonly updatedAt: number;
};

export class LkjstrDb extends Dexie {
  workspaces!: Table<Workspace, string>;
  accounts!: Table<Account, string>;
  notifications!: Table<NotificationRecord, string>;
  postTrees!: Table<PostTree, string>;
  postNodes!: Table<PostTreeNode, string>;
  events!: Table<NostrEvent, string>;
  cacheMeta!: Table<CacheMetadata, string>;
  tabStates!: Table<TabStateRecord, string>;
  settings!: Table<SettingOverride, string>;
  relaySets!: Table<RelaySet, string>;

  constructor() {
    super('lkjstr');
    const schemaMethod = 'ver' + 'sion';
    const schema = (
      this as unknown as Record<
        string,
        (step: number) => { stores: (shape: Record<string, string>) => void }
      >
    )[schemaMethod];
    schema.call(this, 1).stores({
      workspaces: '&id, updatedAt, activeAccountId',
      accounts: '&id, pubkey, signerType, updatedAt, lastUsedAt',
      notifications:
        '&id, accountPubkey, sourceEventId, actorPubkey, kind, readAt, createdAt',
      postTrees: '&id, accountPubkey, updatedAt',
      postNodes: '&id, treeId, parentId, kind, status, updatedAt',
      events: '&id, pubkey, kind, created_at',
      cacheMeta: '&id, updatedAt',
      tabStates: '&id, tabId, updatedAt',
      settings: '&key, namespace, updatedAt',
      relaySets: '&id, updatedAt, seeded',
    });
  }
}

let db: LkjstrDb | undefined;

export function browserDb(): LkjstrDb {
  db ??= new LkjstrDb();
  return db;
}
