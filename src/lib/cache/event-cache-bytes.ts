import { browserDb } from '../storage/browser-db';
import { indexedDbAvailable } from '../storage/safe-storage';

export async function estimatedEventCacheBytes(): Promise<number> {
  if (!indexedDbAvailable()) return 0;
  let total = 0;
  await browserDb().eventPriority.each((row) => {
    total += row.cacheBytes ?? 0;
  });
  return total;
}
