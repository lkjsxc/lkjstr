export type FeedPagingPhase = 'idle' | 'loadingOlder' | 'end' | 'error';

export type FeedPagingInput = {
  readonly loadingOlder: boolean;
  readonly hasOlder: boolean;
  readonly rowCount: number;
  readonly error?: string | null;
};

export function feedPagingPhase(input: FeedPagingInput): FeedPagingPhase {
  if (input.error) return 'error';
  if (input.loadingOlder && input.hasOlder) return 'loadingOlder';
  if (!input.hasOlder && input.rowCount > 0) return 'end';
  return 'idle';
}
