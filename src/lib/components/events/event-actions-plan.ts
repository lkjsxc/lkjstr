import { customEmojiTokenText, type CustomEmoji } from '$lib/protocol';
import type { RelaySet } from '$lib/relays/relay-store';
import { timelineRelays } from '$lib/timeline/timeline-subscription';

export type EventActionMode = 'none' | 'reply' | 'zap';

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

export type EventActionReactionInput = {
  readonly content: string;
  readonly emoji?: CustomEmoji;
};

export type EventActionEmojiSourcePlan = {
  readonly key: string;
  readonly pubkey?: string;
  readonly relays: readonly string[];
};

export type EventActionLabels = {
  readonly heart: 'Heart';
  readonly publishReply: 'Publish reply';
  readonly reply: 'Reply';
  readonly repost: 'Repost';
  readonly zap: 'Zap';
};

const actionFailedStatus = 'Action failed.';

export function toggleEventActionMode(
  current: EventActionMode,
  target: Exclude<EventActionMode, 'none'>,
): EventActionMode {
  return current === target ? 'none' : target;
}

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

export function eventActionLabels(): EventActionLabels {
  return {
    heart: 'Heart',
    publishReply: 'Publish reply',
    reply: 'Reply',
    repost: 'Repost',
    zap: 'Zap',
  };
}

export function eventActionErrorStatus(error: unknown): string {
  return error instanceof Error ? error.message : actionFailedStatus;
}

export function canSubmitEventActionReply(
  reply: string,
  busy: boolean,
): boolean {
  return !busy && reply.trim().length > 0;
}

type EventActionReplySubmitEvent = {
  preventDefault(): void;
};

type EventActionReplyKeyEvent = {
  readonly ctrlKey: boolean;
  readonly key: string;
};

export function submitEventActionReply(
  event: EventActionReplySubmitEvent,
  submit: () => void,
): void {
  event.preventDefault();
  submit();
}

export function eventActionReplyKeySubmits(input: {
  readonly ctrlKey: boolean;
  readonly key: string;
}): boolean {
  return input.ctrlKey && input.key === 'Enter';
}

export function submitEventActionReplyShortcut(
  event: EventActionReplyKeyEvent,
  submit: () => void,
): boolean {
  if (!eventActionReplyKeySubmits(event)) return false;
  submit();
  return true;
}

export function planUnicodeEventReaction(
  content: string,
): EventActionReactionInput {
  return { content };
}

export function planCustomEmojiEventReaction(
  emoji: CustomEmoji,
): EventActionReactionInput {
  return {
    content: customEmojiTokenText(emoji.shortcode),
    emoji,
  };
}

export function planEventActionEmojiSource(
  activeAccountPubkey: string | null | undefined,
  relaySets: readonly RelaySet[],
): EventActionEmojiSourcePlan {
  const relays = timelineRelays(relaySets);
  return {
    key: `${activeAccountPubkey ?? ''}|${relays.join('\u0000')}`,
    pubkey: activeAccountPubkey ?? undefined,
    relays,
  };
}
