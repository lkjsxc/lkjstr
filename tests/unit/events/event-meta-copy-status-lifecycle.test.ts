import { describe, expect, it } from 'vitest';
import {
  createEventMetaCopyStatusResetter,
  eventMetaCopyStatusResetPlan,
  type EventMetaCopyStatus,
} from '../../../src/lib/components/events/event-meta-overflow';

describe('event meta copy status lifecycle', () => {
  it('keeps retained copy status reset timing explicit', () => {
    expect(eventMetaCopyStatusResetPlan()).toEqual({
      clearStatus: null,
      delayMs: 1200,
    });
  });

  it('resets copy status after the planned delay and clears stale timers', () => {
    const statuses: Array<EventMetaCopyStatus | null> = [];
    const timers: CopyStatusTimer[] = [];
    const cleared: unknown[] = [];
    const resetter = createEventMetaCopyStatusResetter(
      (status) => statuses.push(status),
      copyStatusScheduler(timers, cleared),
    );

    resetter.show({ kind: 'copied' });
    expect(statuses).toEqual([{ kind: 'copied' }]);
    expect(timers.map(timerSummary)).toEqual([
      { delayMs: 1200, id: 'timer-1' },
    ]);

    timers[0].callback();
    expect(statuses).toEqual([{ kind: 'copied' }, null]);

    resetter.show({ kind: 'failed', reason: 'denied' });
    resetter.show({ kind: 'copied' });
    resetter.clear();
    resetter.clear();

    expect(statuses).toEqual([
      { kind: 'copied' },
      null,
      { kind: 'failed', reason: 'denied' },
      { kind: 'copied' },
    ]);
    expect(cleared).toEqual(['timer-2', 'timer-3']);
  });
});

type CopyStatusTimer = {
  callback: () => void;
  delayMs: number;
  id: string;
};

function copyStatusScheduler(timers: CopyStatusTimer[], cleared: unknown[]) {
  return {
    clearTimeout(timer: unknown) {
      cleared.push(timer);
    },
    setTimeout(callback: () => void, delayMs: number) {
      const timer = {
        callback,
        delayMs,
        id: `timer-${timers.length + 1}`,
      };
      timers.push(timer);
      return timer.id;
    },
  };
}

function timerSummary(timer: CopyStatusTimer): {
  delayMs: number;
  id: string;
} {
  return {
    delayMs: timer.delayMs,
    id: timer.id,
  };
}
