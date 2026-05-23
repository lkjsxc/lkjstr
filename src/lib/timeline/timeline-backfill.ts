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
  let cursor: FeedCursorPoint | undefined = nowCursor();
  const phases = [2, 7];
  try {
    for (const [index, days] of phases.entries()) {
      if (stopped() || !cursor) break;
      await sharedJobManager.updateProgress(job.id, {
        current: index,
        total: phases.length,
        label: `Scanning ${days} day window`,
      });
      const page = await loadOlderTimelinePage({
        items: request.items(),
        authors: request.authors,
        relays: request.relays,
        subId: `${request.subId}:backfill:${days}`,
        cursor,
        pageSize: request.pageSize,
        subscriptions: request.subscriptions,
      });
      await sharedJobManager.appendOutput(
        job.id,
        `Stored ${page.items.length} rows for ${days} day window.`,
      );
      const last = page.items.at(-1)?.event;
      cursor =
        page.nextOlderCursor ??
        (last
          ? { createdAt: last.created_at, id: last.id }
          : cursorForDaysAgo(days));
    }
  } catch (error) {
    await sharedJobManager.appendOutput(job.id, String(error));
    await sharedJobManager.setStatus(job.id, 'failed', String(error));
    return;
  }
  if (stopped()) await sharedJobManager.setStatus(job.id, 'canceled');
  else {
    await sharedJobManager.updateProgress(job.id, {
      current: phases.length,
      total: phases.length,
      label: 'Complete',
    });
    await sharedJobManager.appendOutput(job.id, 'Backfill completed.');
    await sharedJobManager.setStatus(job.id, 'completed');
  }
}

function nowCursor(): FeedCursorPoint {
  return { createdAt: Math.floor(Date.now() / 1000), id: 'f'.repeat(64) };
}

function cursorForDaysAgo(days: number): FeedCursorPoint {
  return {
    createdAt: Math.floor(Date.now() / 1000) - days * 24 * 60 * 60,
    id: 'f'.repeat(64),
  };
}
