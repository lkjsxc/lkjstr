import type { EventActionMode } from './event-actions-plan';

export type EventActionResult = {
  readonly ok: boolean;
  readonly message?: string;
};

export type EventActionStatusPlan = {
  readonly mode: EventActionMode;
  readonly status: string;
  readonly success: boolean;
};

export type EventActionRunCallbacks = {
  readonly getMode: () => EventActionMode;
  readonly isDestroyed: () => boolean;
  readonly onSuccess?: () => void;
  readonly setBusy: (busy: boolean) => void;
  readonly setMode: (mode: EventActionMode) => void;
  readonly setStatus: (status: string) => void;
};

const actionFailedStatus = 'Action failed.';

export function eventActionResultStatus(result: EventActionResult): string {
  return result.ok ? '' : (result.message ?? actionFailedStatus);
}

export function planEventActionResult(
  current: EventActionMode,
  result: EventActionResult,
): EventActionStatusPlan {
  return {
    mode: result.ok ? 'none' : current,
    status: eventActionResultStatus(result),
    success: result.ok,
  };
}

export function planEventActionError(
  current: EventActionMode,
  error: unknown,
): EventActionStatusPlan {
  return {
    mode: current,
    status: eventActionErrorStatus(error),
    success: false,
  };
}

export function planEventActionRunStart() {
  return { busy: true, status: '' } as const;
}

export function planEventActionRunSettle(destroyed: boolean) {
  return { apply: !destroyed, busy: false } as const;
}

export async function runEventAction(
  action: () => Promise<EventActionResult>,
  callbacks: EventActionRunCallbacks,
): Promise<void> {
  const start = planEventActionRunStart();
  callbacks.setBusy(start.busy);
  callbacks.setStatus(start.status);
  try {
    const result = await action();
    if (callbacks.isDestroyed()) return;
    const plan = planEventActionResult(callbacks.getMode(), result);
    callbacks.setStatus(plan.status);
    callbacks.setMode(plan.mode);
    if (plan.success) callbacks.onSuccess?.();
  } catch (error) {
    if (callbacks.isDestroyed()) return;
    const plan = planEventActionError(callbacks.getMode(), error);
    callbacks.setStatus(plan.status);
    callbacks.setMode(plan.mode);
  } finally {
    const settled = planEventActionRunSettle(callbacks.isDestroyed());
    if (settled.apply) callbacks.setBusy(settled.busy);
  }
}

export function eventActionErrorStatus(error: unknown): string {
  return error instanceof Error ? error.message : actionFailedStatus;
}
