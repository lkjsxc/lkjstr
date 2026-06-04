import { cacheLedgerId } from '../../cache/cache-ledger-id';
import { ensureEventGraphSchema } from '../sqlite-opfs/event-schema';
import { sendSqliteStorage } from '../sqlite-opfs/kernel-client';

type ProtectionNotificationRow = {
  readonly id: string;
  readonly accountPubkey: string;
  readonly sourceEventId: string;
  readonly createdAt: number;
  readonly readAt: number | null;
  readonly rootEventId?: string;
  readonly targetEventId?: string;
};

export async function collectNotificationProtections(
  ids: Set<string>,
  accountPubkeys: Set<string>,
  limit: number,
): Promise<void> {
  const rows = await sqliteNotificationRows(limit);
  if (!rows) return;
  const latestByAccount = new Map<string, number>();
  const unreadRecentCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  for (const row of rows) {
    const retained = latestByAccount.get(row.accountPubkey) ?? 0;
    if (retained < 200) {
      latestByAccount.set(row.accountPubkey, retained + 1);
      protectNotification(ids, row);
    }
    if (row.readAt === null && row.createdAt * 1000 >= unreadRecentCutoff)
      protectNotification(ids, row);
  }
  await collectPotentialNotificationSources(ids, accountPubkeys, limit);
}

async function collectPotentialNotificationSources(
  ids: Set<string>,
  accountPubkeys: Set<string>,
  limit: number,
): Promise<void> {
  for (const pubkey of accountPubkeys) {
    const response = await sendSqliteStorage(
      {
        kind: 'query',
        statement:
          'SELECT event_id FROM event_tags WHERE tag_name = ?1 AND tag_value = ?2 LIMIT ?3;',
        params: ['p', pubkey, limit],
        rowLimit: limit,
      },
      { deadlineMs: 10_000 },
    );
    if (response.outcome !== 'ok') return;
    for (const row of response.rows) ids.add(String(row.event_id));
  }
}

async function sqliteNotificationRows(
  limit: number,
): Promise<ProtectionNotificationRow[] | undefined> {
  if (!(await ensureEventGraphSchema())) return undefined;
  const response = await sendSqliteStorage(
    {
      kind: 'query',
      statement:
        'SELECT record_json FROM notifications ORDER BY created_at DESC LIMIT ?1;',
      params: [limit],
      rowLimit: limit,
    },
    { deadlineMs: 10_000 },
  );
  if (response.outcome !== 'ok') return undefined;
  return response.rows.flatMap((row) => decodeNotification(row.record_json));
}

function decodeNotification(raw: unknown): ProtectionNotificationRow[] {
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw) as ProtectionNotificationRow;
    return parsed.id && parsed.sourceEventId ? [parsed] : [];
  } catch {
    return [];
  }
}

function protectNotification(
  target: Set<string>,
  row: ProtectionNotificationRow,
): void {
  target.add(cacheLedgerId('notification', row.id));
  target.add(row.sourceEventId);
  if (row.rootEventId) target.add(row.rootEventId);
  if (row.targetEventId) target.add(row.targetEventId);
}
