export type FeedScrollIntent = {
  readonly previousOffset: number;
  readonly pendingDownwardInput: boolean;
};

export function createFeedScrollIntent(
  previousOffset = 0,
): FeedScrollIntent {
  return { previousOffset, pendingDownwardInput: false };
}

export function markDownwardScrollInput(
  intent: FeedScrollIntent,
): FeedScrollIntent {
  return { ...intent, pendingDownwardInput: true };
}

export function consumeDownwardScrollIntent(
  intent: FeedScrollIntent,
  offset: number,
): {
  readonly intent: FeedScrollIntent;
  readonly userScrolledDown: boolean;
} {
  const userScrolledDown =
    intent.pendingDownwardInput && offset > intent.previousOffset;
  return {
    intent: { previousOffset: offset, pendingDownwardInput: false },
    userScrolledDown,
  };
}
