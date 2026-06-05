import type { TimelineItem } from '$lib/timeline/timeline-store';

export type UserTimelineCachePolicy =
  | {
      readonly mode: 'coverage-proven';
      readonly items: readonly TimelineItem[];
      readonly notice: string;
    }
  | {
      readonly mode: 'cache-preview';
      readonly items: readonly TimelineItem[];
      readonly notice: string;
    }
  | {
      readonly mode: 'hold-cache';
      readonly items: readonly TimelineItem[];
      readonly notice: string;
    };

const previewLimit = 10;

export function userTimelineCachePolicy(input: {
  readonly items: readonly TimelineItem[];
  readonly coverageProven: boolean;
  readonly authorSetMatches: boolean;
}): UserTimelineCachePolicy {
  if (input.coverageProven && input.authorSetMatches)
    return { mode: 'coverage-proven', items: input.items, notice: '' };
  if (!input.authorSetMatches)
    return {
      mode: 'hold-cache',
      items: [],
      notice: 'Refreshing relays before showing local cache for this timeline.',
    };
  const dominant = longestAuthorRun(input.items);
  if (dominant > previewLimit)
    return {
      mode: 'hold-cache',
      items: [],
      notice: 'Refreshing relays before showing a biased local cache.',
    };
  return {
    mode: 'cache-preview',
    items: input.items.slice(0, previewLimit),
    notice: 'Local cache preview while relays refresh.',
  };
}

export function longestAuthorRun(items: readonly TimelineItem[]): number {
  let current = '';
  let run = 0;
  let max = 0;
  for (const item of items) {
    if (item.event.pubkey === current) run++;
    else {
      current = item.event.pubkey;
      run = 1;
    }
    max = Math.max(max, run);
  }
  return max;
}
