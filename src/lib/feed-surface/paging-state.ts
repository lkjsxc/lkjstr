export type FeedPagingPhase = 'idle' | 'loadingOlder' | 'end' | 'error';
export type HistoryExhaustion = 'unknown' | 'probing' | 'proven';

export type FeedPagingInput = {
  readonly loadingOlder: boolean;
  readonly hasOlder: boolean;
  readonly historyExhaustion?: HistoryExhaustion;
  readonly rowCount: number;
  readonly error?: string | null;
};

export function feedPagingPhase(input: FeedPagingInput): FeedPagingPhase {
  if (input.error) return 'error';
  if (input.loadingOlder && input.historyExhaustion !== 'proven')
    return 'loadingOlder';
  if (input.historyExhaustion === 'proven' && input.rowCount > 0) return 'end';
  return 'idle';
}
