import { describe, expect, it } from 'vitest';
import { planFeedSurfaceStatus } from '../../../src/lib/components/events/feed-surface-status-plan';

describe('feed surface status plan', () => {
  it('prioritizes explicit errors over loading and end states', () => {
    expect(
      planFeedSurfaceStatus({
        phase: 'loadingOlder',
        loadingOlder: true,
        endOfHistory: true,
        error: 'Relay failed.',
      }),
    ).toEqual({ kind: 'error', text: 'Relay failed.', role: 'alert' });
  });

  it('keeps phase and legacy loading inputs equivalent', () => {
    expect(planFeedSurfaceStatus({ phase: 'loadingOlder' })).toEqual({
      kind: 'loading',
      text: 'Loading older events...',
      ariaBusy: true,
    });
    expect(planFeedSurfaceStatus({ loadingOlder: true })).toEqual({
      kind: 'loading',
      text: 'Loading older events...',
      ariaBusy: true,
    });
  });

  it('keeps phase and legacy end inputs equivalent', () => {
    expect(planFeedSurfaceStatus({ phase: 'end' })).toEqual({
      kind: 'end',
      text: 'End of known history.',
    });
    expect(planFeedSurfaceStatus({ endOfHistory: true })).toEqual({
      kind: 'end',
      text: 'End of known history.',
    });
  });

  it('renders nothing for idle or empty error inputs', () => {
    expect(planFeedSurfaceStatus({ phase: 'idle' })).toEqual({ kind: 'none' });
    expect(planFeedSurfaceStatus({ phase: 'error', error: '' })).toEqual({
      kind: 'none',
    });
  });
});
