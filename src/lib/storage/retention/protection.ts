import Dexie from 'dexie';
import { cacheLedgerId } from '../../cache/cache-ledger-id';
import { pinnedEventIds } from '../../cache/pins';
import { browserDb } from '../browser-db';
import {
  collectPotentialNotificationSources,
  collectProtectedNotifications,
} from './protection-notifications';
import {
  scanRows,
  type MutableProtectionSnapshot,
  type ProtectionSnapshot,
  type ScanSource,
} from './protection-scan';

export type CompactionEventCandidate = {
  readonly id: string;
  readonly pubkey: string;
  readonly kind: number;
  readonly created_at: number;
};

export type ProtectionSnapshotOptions = {
  readonly scanLimit?: number;
};

const DEFAULT_SCAN_LIMIT = 10_000;

export function latestEventIdsByPubkey(
  events: readonly CompactionEventCandidate[],
  kind: number,
  wantedPubkeys?: ReadonlySet<string>,
): Set<string> {
  const latestByPubkey = new Map<string, CompactionEventCandidate>();
  for (const event of events) {
    if (event.kind !== kind) continue;
    if (wantedPubkeys && !wantedPubkeys.has(event.pubkey)) continue;
    const current = latestByPubkey.get(event.pubkey);
    if (!current || event.created_at > current.created_at)
      latestByPubkey.set(event.pubkey, event);
  }
  return new Set([...latestByPubkey.values()].map((event) => event.id));
}

export async function protectedEventIds(): Promise<Set<string>> {
  return (await protectionSnapshot()).ids;
}

export async function protectionSnapshot(
  options: ProtectionSnapshotOptions = {},
): Promise<ProtectionSnapshot> {
  const snapshot: MutableProtectionSnapshot = {
    ids: pinnedEventIds(),
    complete: true,
    scannedRows: 0,
  };
  const limit = options.scanLimit ?? DEFAULT_SCAN_LIMIT;
  await collectLatestByKindPubkey(0, snapshot, limit);
  const accountPubkeys = await loadAccountPubkeys(snapshot, limit);
  if (accountPubkeys.size > 0) {
    await collectLatestByKindPubkeyForSet(3, accountPubkeys, snapshot, limit);
    await collectPotentialNotificationSources(accountPubkeys, snapshot, limit);
  }
  await collectActiveTabStates(snapshot, limit);
  await collectProtectedNotifications(snapshot, limit);
  await collectProtectedEventLedgerRows(snapshot, limit);
  return snapshot;
}

async function loadAccountPubkeys(
  snapshot: MutableProtectionSnapshot,
  limit: number,
): Promise<Set<string>> {
  const pubkeys = new Set<string>();
  await scanRows(snapshot, browserDb().accounts, limit, (account) => {
    pubkeys.add(account.pubkey);
  });
  return pubkeys;
}

async function collectActiveTabStates(
  snapshot: MutableProtectionSnapshot,
  limit: number,
): Promise<void> {
  await scanRows(snapshot, browserDb().workspaces, limit, (workspace) => {
    for (const tabId of Object.keys(workspace.tabs)) {
      const resourceId = `${workspace.id}:${tabId}`;
      snapshot.ids.add(resourceId);
      snapshot.ids.add(cacheLedgerId('tab-snapshot', resourceId));
    }
  });
}

async function collectLatestByKindPubkey(
  kind: number,
  snapshot: MutableProtectionSnapshot,
  limit: number,
): Promise<void> {
  await collectLatestEvents(kind, undefined, snapshot, limit);
}

async function collectLatestByKindPubkeyForSet(
  kind: number,
  wantedPubkeys: Set<string>,
  snapshot: MutableProtectionSnapshot,
  limit: number,
): Promise<void> {
  await collectLatestEvents(kind, wantedPubkeys, snapshot, limit);
}

async function collectLatestEvents(
  kind: number,
  wantedPubkeys: Set<string> | undefined,
  snapshot: MutableProtectionSnapshot,
  limit: number,
): Promise<void> {
  const latestByPubkey = new Map<string, CompactionEventCandidate>();
  await scanRows(snapshot, eventsByKind(kind), limit, (event) => {
    if (wantedPubkeys && !wantedPubkeys.has(event.pubkey)) return;
    const current = latestByPubkey.get(event.pubkey);
    if (!current || event.created_at > current.created_at)
      latestByPubkey.set(event.pubkey, event);
  });
  for (const event of latestByPubkey.values()) snapshot.ids.add(event.id);
}

function eventsByKind(kind: number): ScanSource<CompactionEventCandidate> {
  return browserDb()
    .events.where('[pubkey+kind+created_at]')
    .between(
      [Dexie.minKey, kind, Dexie.minKey],
      [Dexie.maxKey, kind, Dexie.maxKey],
    );
}

async function collectProtectedEventLedgerRows(
  snapshot: MutableProtectionSnapshot,
  limit: number,
): Promise<void> {
  await scanRows(
    snapshot,
    browserDb()
      .cacheLedger.where('ownerKind')
      .equals('event')
      .filter((row) => row.protected),
    limit,
    (row) => snapshot.ids.add(row.resourceId),
  );
}
