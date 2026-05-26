import {
  feedPagingPhase,
  type FeedPagingInput,
  type FeedPagingPhase,
} from './paging-state';

export type { FeedPagingPhase };

export function footerPhaseFromPaging(
  input: FeedPagingInput,
): FeedPagingPhase {
  return feedPagingPhase(input);
}

export function feedSurfaceStatusProps(phase: FeedPagingPhase, error?: string) {
  return {
    phase,
    loadingOlder: phase === 'loadingOlder',
    endOfHistory: phase === 'end',
    error: phase === 'error' ? error : undefined,
  };
}
