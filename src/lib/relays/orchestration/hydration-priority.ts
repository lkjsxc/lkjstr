export type HydrationPriority =
  | 'visible'
  | 'near-visible'
  | 'active-offscreen'
  | 'hidden-paused'
  | 'background'
  | 'cancelled';

export type HydrationJob = {
  readonly key: string;
  readonly priority: HydrationPriority;
  readonly generation: number;
};

const priorityRank: Record<HydrationPriority, number> = {
  visible: 0,
  'near-visible': 1,
  'active-offscreen': 2,
  'hidden-paused': 3,
  background: 4,
  cancelled: 5,
};

export function planHydrationJobs(input: {
  readonly jobs: readonly HydrationJob[];
  readonly generation: number;
}): {
  readonly runnable: readonly HydrationJob[];
  readonly cancelled: readonly string[];
} {
  const cancelled: string[] = [];
  const byKey = new Map<string, HydrationJob>();
  for (const job of input.jobs) {
    if (job.generation !== input.generation || job.priority === 'cancelled') {
      cancelled.push(job.key);
      continue;
    }
    if (job.priority === 'hidden-paused') continue;
    const current = byKey.get(job.key);
    if (!current || priorityRank[job.priority] < priorityRank[current.priority])
      byKey.set(job.key, job);
  }
  return {
    runnable: [...byKey.values()].sort(compareHydrationJobs),
    cancelled,
  };
}

function compareHydrationJobs(left: HydrationJob, right: HydrationJob): number {
  const byPriority = priorityRank[left.priority] - priorityRank[right.priority];
  return byPriority || left.key.localeCompare(right.key);
}
