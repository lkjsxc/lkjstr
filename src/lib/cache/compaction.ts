import { browserDb } from '../storage/browser-db';
import { eventRetention } from './retention';

export type CompactionResult = {
  readonly prunedEvents: number;
  readonly skippedDrafts: boolean;
};

export async function compactOldEvents(
  maxAgeSeconds = 90 * 24 * 60 * 60,
): Promise<CompactionResult> {
  const now = Math.floor(Date.now() / 1000);
  const events = await browserDb().events.toArray();
  const pruneIds = events
    .filter((event) => eventRetention(event, now, maxAgeSeconds) === 'prune')
    .map((event) => event.id);
  await browserDb().events.bulkDelete(pruneIds);
  return { prunedEvents: pruneIds.length, skippedDrafts: true };
}
