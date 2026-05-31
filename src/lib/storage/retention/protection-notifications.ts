import { cacheLedgerId } from '../../cache/cache-ledger-id';
import { browserDb } from '../browser-db';
import { scanRows, type MutableProtectionSnapshot } from './protection-scan';

export async function collectProtectedNotifications(
  snapshot: MutableProtectionSnapshot,
  limit: number,
): Promise<void> {
  const latestByAccount = new Map<string, string[]>();
  const unreadRecentCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  await scanRows(
    snapshot,
    browserDb().notifications.orderBy('createdAt').reverse(),
    limit,
    (row) => {
      const retained = latestByAccount.get(row.accountPubkey) ?? [];
      if (retained.length < 200) {
        retained.push(row.id);
        latestByAccount.set(row.accountPubkey, retained);
        protectNotification(snapshot.ids, row);
      }
      if (row.readAt === null && row.createdAt * 1000 >= unreadRecentCutoff)
        protectNotification(snapshot.ids, row);
    },
  );
}

export async function collectPotentialNotificationSources(
  accountPubkeys: Set<string>,
  snapshot: MutableProtectionSnapshot,
  limit: number,
): Promise<void> {
  for (const pubkey of accountPubkeys) {
    if (!snapshot.complete) return;
    await scanRows(
      snapshot,
      browserDb().eventTags.where('[tagName+tagValue]').equals(['p', pubkey]),
      limit,
      (row) => snapshot.ids.add(row.eventId),
    );
  }
}

function protectNotification(
  target: Set<string>,
  row: {
    readonly id: string;
    readonly sourceEventId: string;
    readonly rootEventId?: string;
    readonly targetEventId?: string;
  },
): void {
  target.add(cacheLedgerId('notification', row.id));
  target.add(row.sourceEventId);
  if (row.rootEventId) target.add(row.rootEventId);
  if (row.targetEventId) target.add(row.targetEventId);
}
