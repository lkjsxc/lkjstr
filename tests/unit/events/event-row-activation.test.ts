import { describe, expect, it } from 'vitest';
import {
  createEventRowSuccessHighlighter,
  eventRowCanOpenThread,
  eventRowClickOpensThread,
  eventRowKeyOpensThread,
  eventRowSuccessHighlightPlan,
  openEventThread,
  openEventThreadFromRowClick,
  openEventThreadFromRowKey,
} from '../../../src/lib/components/events/event-row-activation';

describe('event row activation', () => {
  it('suppresses thread opens when no real opener exists', () => {
    const opened: string[] = [];

    expect(eventRowCanOpenThread(undefined)).toBe(false);
    expect(openEventThread(undefined, 'event-a')).toBe(false);
    expect(openEventThread((eventId) => opened.push(eventId), 'event-b')).toBe(
      true,
    );
    expect(opened).toEqual(['event-b']);
  });

  it('opens row clicks except for retained local controls', () => {
    const rowTarget = {
      closest: () => null,
    } as unknown as EventTarget;
    const controlTarget = {
      closest: (selector: string) =>
        selector.includes('.event-action-zone') ? {} : null,
    } as unknown as EventTarget;

    expect(eventRowClickOpensThread()).toBe(true);
    expect(eventRowClickOpensThread({ target: rowTarget })).toBe(true);
    expect(eventRowClickOpensThread({ target: controlTarget })).toBe(false);
  });

  it('dispatches retained row clicks only for row-level activation', () => {
    const opened: string[] = [];
    const rowTarget = {
      closest: () => null,
    } as unknown as EventTarget;
    const controlTarget = {
      closest: (selector: string) =>
        selector.includes('.event-action-zone') ? {} : null,
    } as unknown as EventTarget;
    const open = (eventId: string): void => {
      opened.push(eventId);
    };

    expect(openEventThreadFromRowClick({ target: rowTarget }, open, 'a')).toBe(
      true,
    );
    expect(
      openEventThreadFromRowClick({ target: controlTarget }, open, 'b'),
    ).toBe(false);
    expect(openEventThreadFromRowClick(undefined, undefined, 'c')).toBe(false);
    expect(opened).toEqual(['a']);
  });

  it('keeps text-node targets inside controls local', () => {
    const textTarget = {
      parentElement: {
        closest: (selector: string) =>
          selector.includes('button') ? {} : null,
      },
    } as unknown as EventTarget;

    expect(eventRowClickOpensThread({ target: textTarget })).toBe(false);
  });

  it('opens only Enter from the focused row itself', () => {
    const row = {} as EventTarget;
    const child = {} as EventTarget;

    expect(
      eventRowKeyOpensThread({
        key: 'Enter',
        target: row,
        currentTarget: row,
      }),
    ).toBe(true);
    expect(
      eventRowKeyOpensThread({
        key: ' ',
        target: row,
        currentTarget: row,
      }),
    ).toBe(false);
    expect(
      eventRowKeyOpensThread({
        key: 'Enter',
        target: child,
        currentTarget: row,
      }),
    ).toBe(false);
  });

  it('dispatches retained keyboard opens only from the focused row', () => {
    const opened: string[] = [];
    const row = {} as EventTarget;
    const child = {} as EventTarget;
    const open = (eventId: string): void => {
      opened.push(eventId);
    };

    expect(
      openEventThreadFromRowKey(
        { key: 'Enter', target: row, currentTarget: row },
        open,
        'a',
      ),
    ).toBe(true);
    expect(
      openEventThreadFromRowKey(
        { key: 'Enter', target: child, currentTarget: row },
        open,
        'b',
      ),
    ).toBe(false);
    expect(
      openEventThreadFromRowKey(
        { key: ' ', target: row, currentTarget: row },
        open,
        'c',
      ),
    ).toBe(false);
    expect(opened).toEqual(['a']);
  });

  it('keeps retained row success highlight timing explicit', () => {
    expect(eventRowSuccessHighlightPlan()).toEqual({
      highlighted: true,
      durationMs: 900,
    });
  });

  it('schedules, clears, and destroys retained row success highlights', () => {
    const states: boolean[] = [];
    const timers: RowHighlightTimer[] = [];
    const cleared: unknown[] = [];
    const scheduler = rowHighlightScheduler(timers, cleared);
    const highlighter = createEventRowSuccessHighlighter(
      (highlighted) => states.push(highlighted),
      scheduler,
    );

    highlighter.trigger();
    expect(states).toEqual([true]);
    expect(timers.map(({ delayMs, id }) => ({ delayMs, id }))).toEqual([
      { delayMs: 900, id: 'timer-1' },
    ]);

    timers[0].callback();
    expect(states).toEqual([true, false]);

    highlighter.trigger();
    highlighter.trigger();
    highlighter.destroy();
    highlighter.destroy();

    expect(states).toEqual([true, false, true, true]);
    expect(cleared).toEqual(['timer-2', 'timer-3']);
  });
});

type RowHighlightTimer = {
  callback: () => void;
  delayMs: number;
  id: string;
};

function rowHighlightScheduler(
  timers: RowHighlightTimer[],
  cleared: unknown[] = [],
) {
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
