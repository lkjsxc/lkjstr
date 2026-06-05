import { describe, expect, it } from 'vitest';
import {
  planHydrationJobs,
  type HydrationJob,
} from '../../../../src/lib/relays/orchestration/hydration-priority';

describe('hydration priority', () => {
  it('runs visible and near-visible jobs before background work', () => {
    const plan = planHydrationJobs({
      generation: 9,
      jobs: [
        job('background', 'background', 9),
        job('near', 'near-visible', 9),
        job('visible', 'visible', 9),
      ],
    });

    expect(plan.runnable.map((item) => item.key)).toEqual([
      'visible',
      'near',
      'background',
    ]);
  });

  it('dedupes by semantic key and cancels stale jobs', () => {
    const plan = planHydrationJobs({
      generation: 4,
      jobs: [
        job('profile:alice', 'background'),
        job('profile:alice', 'visible'),
        job('profile:bob', 'hidden-paused'),
        { ...job('profile:carol', 'visible'), generation: 3 },
      ],
    });

    expect(plan.runnable).toMatchObject([
      { key: 'profile:alice', priority: 'visible' },
    ]);
    expect(plan.cancelled).toEqual(['profile:carol']);
  });
});

function job(
  key: string,
  priority: HydrationJob['priority'],
  generation = 4,
): HydrationJob {
  return { key, priority, generation };
}
