import { describe, expect, it } from 'vitest';
import {
  consumeDownwardScrollIntent,
  createFeedScrollIntent,
  markDownwardScrollInput,
} from '../../../src/lib/components/feed/feed-scroll-intent';

describe('feed scroll intent', () => {
  it('consumes a pending downward input on the next downward scroll', () => {
    const start = createFeedScrollIntent(10);
    const result = consumeDownwardScrollIntent(
      markDownwardScrollInput(start),
      30,
    );
    expect(result.userScrolledDown).toBe(true);
    expect(result.intent.pendingDownwardInput).toBe(false);

    const stale = consumeDownwardScrollIntent(result.intent, 60);
    expect(stale.userScrolledDown).toBe(false);
  });

  it('rejects programmatic or upward movement as user history intent', () => {
    expect(
      consumeDownwardScrollIntent(createFeedScrollIntent(10), 30)
        .userScrolledDown,
    ).toBe(false);
    expect(
      consumeDownwardScrollIntent(
        markDownwardScrollInput(createFeedScrollIntent(30)),
        10,
      ).userScrolledDown,
    ).toBe(false);
  });
});
