import { browserDb } from '../storage/browser-db';
import { eventRetention } from './retention';

export type CompactionResult = {
  readonly prunedEvents: number;
  readonly skippedDrafts: boolean;
};

export async function compactOldEvents(
  maxAgeSeconds = 30 * 24 * 60 * 60,
  maxEvents = 5000,
): Promise<CompactionResult> {
  if (typeof indexedDB === 'undefined')
    return { prunedEvents: 0, skippedDrafts: true };
  const now = Math.floor(Date.now() / 1000);
  const events = (await browserDb().events.toArray()).sort(
    (a, b) => b.created_at - a.created_at,
  );
  const keepIds = new Set(events.slice(0, maxEvents).map((event) => event.id));
  const pruneIds = events
    .filter(
      (event) =>
        !keepIds.has(event.id) ||
        eventRetention(event, now, maxAgeSeconds) === 'prune',
    )
    .map((event) => event.id);
  await browserDb().transaction(
    'rw',
    browserDb().events,
    browserDb().eventRelays,
    browserDb().eventTags,
    async () => {
      await browserDb().events.bulkDelete(pruneIds);
      await Promise.all(
        pruneIds.flatMap((id) => [
          browserDb().eventRelays.where('eventId').equals(id).delete(),
          browserDb().eventTags.where('eventId').equals(id).delete(),
        ]),
      );
    },
  );
  return { prunedEvents: pruneIds.length, skippedDrafts: true };
}
