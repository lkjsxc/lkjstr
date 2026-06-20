import type { EventActionLabels } from './event-actions-label-plan';
import type { EventActionMode } from './event-actions-plan';
import { canSubmitEventActionReply } from './event-actions-reply-plan';

export type EventActionReplyPanelPlan = {
  readonly kind: 'reply';
  readonly publishLabel: EventActionLabels['publishReply'];
  readonly replyLabel: EventActionLabels['reply'];
  readonly submitDisabled: boolean;
};

export type EventActionZapPanelPlan = {
  readonly kind: 'zap';
};

export type EventActionPanelPlan =
  | EventActionReplyPanelPlan
  | EventActionZapPanelPlan
  | {
      readonly kind: 'none';
    };

export function planEventActionPanel(input: {
  readonly busy: boolean;
  readonly labels: Pick<EventActionLabels, 'publishReply' | 'reply'>;
  readonly mode: EventActionMode;
  readonly reply: string;
}): EventActionPanelPlan {
  if (input.mode === 'reply') {
    return {
      kind: 'reply',
      publishLabel: input.labels.publishReply,
      replyLabel: input.labels.reply,
      submitDisabled: !canSubmitEventActionReply(input.reply, input.busy),
    };
  }
  if (input.mode === 'zap') {
    return { kind: 'zap' };
  }
  return { kind: 'none' };
}
