export type EventMetaCopyStatus =
  | {
      readonly kind: 'copied';
    }
  | {
      readonly kind: 'failed';
      readonly reason: string;
    };

export type EventMetaClipboard = {
  readonly writeText?: (value: string) => Promise<void>;
};

export type EventMetaCopyStatusScheduler = {
  clearTimeout(timer: unknown): void;
  setTimeout(callback: () => void, delayMs: number): unknown;
};

export type EventMetaCopyStatusResetter = {
  clear(): void;
  show(status: EventMetaCopyStatus): void;
};

export type EventMetaCopyStatusResetPlan = {
  readonly clearStatus: null;
  readonly delayMs: 1200;
};

const eventMetaCopyStatusScheduler: EventMetaCopyStatusScheduler = {
  clearTimeout(timer) {
    clearTimeout(timer as ReturnType<typeof setTimeout>);
  },
  setTimeout(callback, delayMs) {
    return setTimeout(callback, delayMs);
  },
};

export async function copyEventIdToClipboard(
  eventId: string,
  clipboard: EventMetaClipboard | undefined,
): Promise<EventMetaCopyStatus> {
  if (!clipboard?.writeText) {
    return { kind: 'failed', reason: 'Clipboard unavailable' };
  }
  try {
    await clipboard.writeText(eventId);
    return { kind: 'copied' };
  } catch (error) {
    return { kind: 'failed', reason: copyFailureReason(error) };
  }
}

export function eventMetaCopyStatusLabel(status: EventMetaCopyStatus): string {
  if (status.kind === 'copied') {
    return 'Copied';
  }
  return `Copy failed: ${status.reason}`;
}

export function eventMetaCopyStatusResetPlan(): EventMetaCopyStatusResetPlan {
  return { clearStatus: null, delayMs: 1200 };
}

export function createEventMetaCopyStatusResetter(
  setStatus: (status: EventMetaCopyStatus | null) => void,
  scheduler: EventMetaCopyStatusScheduler = eventMetaCopyStatusScheduler,
): EventMetaCopyStatusResetter {
  let timer: unknown;
  const reset = eventMetaCopyStatusResetPlan();

  function clearTimer(): void {
    if (!timer) return;
    scheduler.clearTimeout(timer);
    timer = undefined;
  }

  return {
    clear() {
      clearTimer();
    },
    show(status) {
      setStatus(status);
      clearTimer();
      timer = scheduler.setTimeout(() => {
        timer = undefined;
        setStatus(reset.clearStatus);
      }, reset.delayMs);
    },
  };
}

function copyFailureReason(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return 'Clipboard write failed';
}
