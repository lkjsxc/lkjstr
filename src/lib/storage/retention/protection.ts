import { cacheLedgerId } from '../../cache/cache-ledger-id';
import { pinnedEventIds } from '../../cache/pins';
import { bootstrapWorkspaceId } from '../../workspace/workspace-bootstrap';
import { sqliteReadAccounts } from '../sqlite-opfs/accounts-sqlite';
import { ensureEventGraphSchema } from '../sqlite-opfs/event-schema';
import { sendSqliteStorage } from '../sqlite-opfs/kernel-client';
import { sqliteReadWorkspace } from '../sqlite-opfs/workspace-sqlite';
import { dexieProtectionSnapshot } from './protection-dexie-fallback';
import type { ProtectionSnapshot } from './protection-scan';

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
  const ids = pinnedEventIds();
  const limit = options.scanLimit ?? DEFAULT_SCAN_LIMIT;
  const eventRows = await sqliteProtectionEvents(limit).catch(() => undefined);
  const protectedRows = await sqliteProtectedLedgerRows(limit).catch(
    () => undefined,
  );
  if (!eventRows || !protectedRows) return dexieProtectionSnapshot(options);
  for (const id of latestEventIdsByPubkey(eventRows, 0)) ids.add(id);
  const accountPubkeys = new Set(
    (await sqliteReadAccounts().catch(() => []))?.map((row) => row.pubkey) ??
      [],
  );
  for (const id of latestEventIdsByPubkey(eventRows, 3, accountPubkeys))
    ids.add(id);
  for (const row of protectedRows) ids.add(row.resourceId);
  await collectActiveTabStates(ids).catch(() => undefined);
  return {
    ids,
    complete: eventRows.length + protectedRows.length < limit,
    scannedRows: eventRows.length + protectedRows.length,
    reason:
      eventRows.length + protectedRows.length >= limit
        ? 'scan-limit'
        : undefined,
  };
}

async function collectActiveTabStates(ids: Set<string>): Promise<void> {
  const workspace = await sqliteReadWorkspace(bootstrapWorkspaceId);
  if (!workspace) return;
  for (const tabId of Object.keys(workspace.tabs)) {
    const resourceId = `${workspace.id}:${tabId}`;
    ids.add(resourceId);
    ids.add(cacheLedgerId('tab-snapshot', resourceId));
  }
}

async function sqliteProtectionEvents(
  limit: number,
): Promise<CompactionEventCandidate[] | undefined> {
  if (!(await ensureEventGraphSchema())) return undefined;
  const response = await sendSqliteStorage(
    {
      kind: 'query',
      statement:
        'SELECT id, pubkey, kind, created_at FROM events WHERE kind IN (0, 3) ORDER BY created_at DESC LIMIT ?1;',
      params: [limit],
      rowLimit: limit,
    },
    { deadlineMs: 10_000 },
  );
  if (response.outcome !== 'ok') return undefined;
  return response.rows.map((row) => ({
    id: String(row.id),
    pubkey: String(row.pubkey),
    kind: Number(row.kind),
    created_at: Number(row.created_at),
  }));
}

async function sqliteProtectedLedgerRows(
  limit: number,
): Promise<{ readonly resourceId: string }[] | undefined> {
  if (!(await ensureEventGraphSchema())) return undefined;
  const response = await sendSqliteStorage(
    {
      kind: 'query',
      statement:
        'SELECT resource_id FROM cache_ledger WHERE protected = 1 LIMIT ?1;',
      params: [limit],
      rowLimit: limit,
    },
    { deadlineMs: 10_000 },
  );
  if (response.outcome !== 'ok') return undefined;
  return response.rows.map((row) => ({ resourceId: String(row.resource_id) }));
}
