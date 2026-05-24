import type { FeedCursorPoint } from '../events/types';
import { sharedJobManager } from '../jobs/job-manager';
import type { RelaySubscriptionManager } from '../relays/subscription-manager';
import { loadOlderTimelinePage } from './timeline-runtime-paging';
import type { TimelineItem } from './timeline-store';

type BackfillRequest = {
  readonly items: () => TimelineItem[];
  readonly authors: readonly string[];
  readonly relays: readonly string[];
  readonly subId: string;
  readonly pageSize: number;
  readonly subscriptions: RelaySubscriptionManager;
};

export function startTimelineBackfill(request: BackfillRequest): () => void {
  let stopped = false;
  void runBackfill(request, () => stopped);
  return () => {
    stopped = true;
  };
}

async function runBackfill(
  request: BackfillRequest,
  stopped: () => boolean,
): Promise<void> {
  if (request.authors.length === 0 || request.relays.length === 0) return;
  const job = await sharedJobManager.enqueue(
    'paged-backfill',
    { feed: 'home', authors: request.authors.length },
    'Home timeline backfill',
  );
  await sharedJobManager.setStatus(job.id, 'running');
  await sharedJobManager.appendOutput(job.id, 'Backfill started.');
  let cursor: FeedCursorPoint | undefined =
    cursorFromOldest(request.items()) ?? nowCursor();
  const workBudget = 12;
  const seenCursors = new Set<string>();
  try {
    for (let index = 0; index < workBudget; index += 1) {
      if (stopped() || !cursor) break;
      const cursorKey = `${cursor.createdAt}:${cursor.id}`;
      if (seenCursors.has(cursorKey)) {
        await sharedJobManager.appendOutput(job.id, 'Backfill cursor stalled.');
        break;
      }
      seenCursors.add(cursorKey);
      await sharedJobManager.updateProgress(job.id, {
        current: index + 1,
        total: workBudget,
        label: 'Scanning relay segment',
      });
      const page = await loadOlderTimelinePage({
        items: request.items(),
        authors: request.authors,
        relays: request.relays,
        subId: `${request.subId}:backfill:${index}`,
        cursor,
        pageSize: request.pageSize,
        subscriptions: request.subscriptions,
      });
      await sharedJobManager.appendOutput(
        job.id,
        `Stored ${page.items.length} visible rows after relay segment scan.`,
      );
      if (!page.hasOlder) break;
      if (!page.nextOlderCursor) {
        await sharedJobManager.appendOutput(
          job.id,
          'Backfill stopped without a continuation cursor.',
        );
        break;
      }
      cursor = page.nextOlderCursor;
    }
  } catch (error) {
    await sharedJobManager.appendOutput(job.id, String(error));
    await sharedJobManager.setStatus(job.id, 'failed', String(error));
    return;
  }
  if (stopped()) await sharedJobManager.setStatus(job.id, 'canceled');
  else {
    await sharedJobManager.updateProgress(job.id, {
      current: workBudget,
      total: workBudget,
      label: 'Complete',
    });
    await sharedJobManager.appendOutput(job.id, 'Backfill completed.');
    await sharedJobManager.setStatus(job.id, 'completed');
  }
}

function nowCursor(): FeedCursorPoint {
  return { createdAt: Math.floor(Date.now() / 1000), id: 'f'.repeat(64) };
}

function cursorFromOldest(
  items: readonly TimelineItem[],
): FeedCursorPoint | undefined {
  const oldest = items.at(-1)?.event;
  return oldest ? { createdAt: oldest.created_at, id: oldest.id } : undefined;
}
