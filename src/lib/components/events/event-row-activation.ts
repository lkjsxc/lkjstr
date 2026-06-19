import { hasOpenThreadAction } from './action-availability';
import { eventRowTargetIsLocal } from './event-row-local-target';

type OpenThreadAction = ((eventId: string) => void) | undefined;

type RowClickEvent = {
  target: EventTarget | null;
};

type RowKeyEvent = {
  key: string;
  target: EventTarget | null;
  currentTarget: EventTarget | null;
};

export type EventRowSuccessHighlightPlan = {
  readonly highlighted: true;
  readonly durationMs: 900;
};

export type EventRowHighlightScheduler = {
  clearTimeout(timer: unknown): void;
  setTimeout(callback: () => void, delayMs: number): unknown;
};

export type EventRowSuccessHighlighter = {
  destroy(): void;
  trigger(): void;
};

const rowHighlightScheduler: EventRowHighlightScheduler = {
  clearTimeout(timer) {
    clearTimeout(timer as ReturnType<typeof setTimeout>);
  },
  setTimeout(callback, delayMs) {
    return setTimeout(callback, delayMs);
  },
};

export function eventRowCanOpenThread(
  openThread: OpenThreadAction,
): openThread is (eventId: string) => void {
  return hasOpenThreadAction(openThread);
}

export function eventRowClickOpensThread(event?: RowClickEvent): boolean {
  return !event || !eventRowTargetIsLocal(event.target);
}

export function eventRowKeyOpensThread(event: RowKeyEvent): boolean {
  return event.key === 'Enter' && event.target === event.currentTarget;
}

export function openEventThread(
  openThread: OpenThreadAction,
  eventId: string,
): boolean {
  if (!eventRowCanOpenThread(openThread)) return false;
  openThread(eventId);
  return true;
}

export function openEventThreadFromRowClick(
  event: RowClickEvent | undefined,
  openThread: OpenThreadAction,
  eventId: string,
): boolean {
  if (!eventRowClickOpensThread(event)) return false;
  return openEventThread(openThread, eventId);
}

export function openEventThreadFromRowKey(
  event: RowKeyEvent,
  openThread: OpenThreadAction,
  eventId: string,
): boolean {
  if (!eventRowKeyOpensThread(event)) return false;
  return openEventThread(openThread, eventId);
}

export function eventRowSuccessHighlightPlan(): EventRowSuccessHighlightPlan {
  return { highlighted: true, durationMs: 900 };
}

export function createEventRowSuccessHighlighter(
  setHighlighted: (highlighted: boolean) => void,
  scheduler: EventRowHighlightScheduler = rowHighlightScheduler,
): EventRowSuccessHighlighter {
  let timer: unknown;
  const plan = eventRowSuccessHighlightPlan();

  function clearTimer(): void {
    if (!timer) return;
    scheduler.clearTimeout(timer);
    timer = undefined;
  }

  return {
    destroy() {
      clearTimer();
    },
    trigger() {
      setHighlighted(plan.highlighted);
      clearTimer();
      timer = scheduler.setTimeout(() => {
        timer = undefined;
        setHighlighted(false);
      }, plan.durationMs);
    },
  };
}
