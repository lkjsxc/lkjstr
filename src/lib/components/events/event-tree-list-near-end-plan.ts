import { nearEndRootMargin } from '$lib/feed-surface/near-end';

export type EventTreeListNearEndInput = {
  readonly enabled: boolean;
  readonly viewportHeight: number;
  readonly onNearEnd?: (() => void | Promise<void>) | undefined;
  readonly scroller?: Element | undefined;
};

export type EventTreeListNearEndPlan = {
  readonly enabled: boolean;
  readonly shouldObserve: boolean;
  readonly rootMargin: string;
};

export function planEventTreeListNearEnd(
  input: EventTreeListNearEndInput,
): EventTreeListNearEndPlan {
  return {
    enabled: input.enabled && Boolean(input.onNearEnd),
    shouldObserve: input.enabled || Boolean(input.scroller),
    rootMargin: nearEndRootMargin(input.viewportHeight),
  };
}
