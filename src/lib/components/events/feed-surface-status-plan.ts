import type { FeedPagingPhase } from '$lib/feed-surface/paging-state';

export type FeedSurfaceStatusPlan =
  | {
      readonly kind: 'error';
      readonly text: string;
      readonly role: 'alert';
    }
  | {
      readonly kind: 'loading';
      readonly text: 'Loading older events...';
      readonly ariaBusy: true;
    }
  | {
      readonly kind: 'end';
      readonly text: 'End of known history.';
    }
  | {
      readonly kind: 'none';
    };

export type FeedSurfaceStatusInput = {
  readonly phase?: FeedPagingPhase;
  readonly loadingOlder?: boolean;
  readonly endOfHistory?: boolean;
  readonly error?: string;
};

export function planFeedSurfaceStatus(
  input: FeedSurfaceStatusInput,
): FeedSurfaceStatusPlan {
  if (input.error) return { kind: 'error', text: input.error, role: 'alert' };
  if (input.phase === 'loadingOlder' || input.loadingOlder)
    return { kind: 'loading', text: 'Loading older events...', ariaBusy: true };
  if (input.phase === 'end' || input.endOfHistory)
    return { kind: 'end', text: 'End of known history.' };
  return { kind: 'none' };
}
