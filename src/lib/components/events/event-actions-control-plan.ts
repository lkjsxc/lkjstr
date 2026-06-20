import type { EventActionLabels } from './event-actions-label-plan';
import type { EventActionMode } from './event-actions-plan';

export type EventActionControlPlan = {
  readonly active: boolean;
  readonly disabled: boolean;
  readonly pressed: boolean;
  readonly title: string;
};

export type EventActionControlsPlan = {
  readonly heart: EventActionControlPlan;
  readonly reply: EventActionControlPlan;
  readonly repost: EventActionControlPlan;
  readonly zap: EventActionControlPlan;
};

export function planEventActionControls(input: {
  readonly busy: boolean;
  readonly labels: Pick<
    EventActionLabels,
    'heart' | 'reply' | 'repost' | 'zap'
  >;
  readonly liked?: boolean;
  readonly mode: EventActionMode;
  readonly reposted?: boolean;
}): EventActionControlsPlan {
  return {
    heart: eventActionButton(input.labels.heart, input.busy, {
      pressed: input.liked,
    }),
    reply: eventActionButton(input.labels.reply, input.busy, {
      active: input.mode === 'reply',
    }),
    repost: eventActionButton(input.labels.repost, input.busy, {
      pressed: input.reposted,
    }),
    zap: eventActionButton(input.labels.zap, input.busy, {
      active: input.mode === 'zap',
    }),
  };
}

function eventActionButton(
  title: string,
  disabled: boolean,
  state: { readonly active?: boolean; readonly pressed?: boolean },
): EventActionControlPlan {
  return {
    active: Boolean(state.active),
    disabled,
    pressed: Boolean(state.pressed),
    title,
  };
}
