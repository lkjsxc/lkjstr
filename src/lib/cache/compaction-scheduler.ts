import { enforceCacheBudget } from './cache-budget-enforcement';
import { defaultCacheMaxBytes } from './storage-quota';
import { loadSettings } from '../settings/settings-store';

export const cacheCompactionWriteThreshold = 25;
const maxCompactionRounds = 3;

let writesSinceSchedule = 0;
let scheduled = false;
let running = false;

export function shouldScheduleCompaction(
  writes: number,
  threshold = cacheCompactionWriteThreshold,
): boolean {
  return writes >= threshold;
}

export function scheduleCacheCompactionAfterWrite(): void {
  writesSinceSchedule += 1;
  if (running || scheduled) return;
  if (!shouldScheduleCompaction(writesSinceSchedule)) return;
  writesSinceSchedule = 0;
  scheduleNow();
}

async function runScheduledCompaction(): Promise<void> {
  if (running) return;
  scheduled = false;
  running = true;
  try {
    const maxBytes = await configuredCacheMaxBytes();
    for (let round = 0; round < maxCompactionRounds; round += 1) {
      const result = await enforceCacheBudget('write', { maxBytes });
      if (result.prunedResources === 0) break;
    }
  } finally {
    running = false;
    if (shouldScheduleCompaction(writesSinceSchedule)) {
      writesSinceSchedule = 0;
      scheduleNow();
    }
  }
}

function scheduleNow(): void {
  scheduled = true;
  queueMicrotask(() => void runScheduledCompaction());
}

async function configuredCacheMaxBytes(): Promise<number> {
  const setting = (await loadSettings()).find(
    (item) => item.key === 'cache.maxBytes',
  );
  return typeof setting?.value === 'number'
    ? setting.value
    : defaultCacheMaxBytes;
}
