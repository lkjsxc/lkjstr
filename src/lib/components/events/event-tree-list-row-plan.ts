import {
  actionStateForEvent,
  type EventActionState,
} from '$lib/events/action-state';
import type { FlatEventTreeItem } from '$lib/events/tree';
import type { ProfileSummary } from '$lib/identity/identity';
import type {
  ReactionGroup,
  ReactionSummaryMap,
  RepostGroup,
  RepostSummaryMap,
} from '$lib/thread/thread-reactions';
import type { EventTreeListContinuationPlan } from './event-tree-list-continuation-plan';
import type { EventTreeListViewRow } from './event-tree-list-helpers';

export type EventTreeListRowDataInput = {
  readonly node: FlatEventTreeItem;
  readonly profiles?: Record<string, ProfileSummary>;
  readonly reactions?: ReactionSummaryMap;
  readonly reposts?: RepostSummaryMap;
  readonly actionStates: Map<string, EventActionState>;
};

export type EventTreeListRowData = {
  readonly profile?: ProfileSummary;
  readonly liked: boolean;
  readonly reposted: boolean;
  readonly reactions?: readonly ReactionGroup[];
  readonly reposts?: RepostGroup;
};

export type EventTreeListRowRenderPlan =
  | {
      readonly kind: 'leading';
      readonly row: Extract<EventTreeListViewRow, { readonly kind: 'leading' }>;
    }
  | { readonly kind: 'terminal' }
  | { readonly kind: 'loadingOlder' }
  | {
      readonly kind: 'empty';
      readonly row: Extract<EventTreeListViewRow, { readonly kind: 'empty' }>;
    }
  | {
      readonly kind: 'continuation';
      readonly continuation: Extract<
        EventTreeListContinuationPlan,
        { readonly visible: true }
      >;
    }
  | {
      readonly kind: 'eventFragment';
      readonly row: Extract<
        EventTreeListViewRow,
        { readonly kind: 'eventFragment' }
      >;
    }
  | {
      readonly kind: 'event';
      readonly row: Extract<EventTreeListViewRow, { readonly kind: 'event' }>;
    }
  | { readonly kind: 'hidden' };

export function eventTreeListRowData(
  input: EventTreeListRowDataInput,
): EventTreeListRowData {
  const event = input.node.event;
  const actions = actionStateForEvent(input.actionStates, event.id);
  return {
    profile: input.profiles?.[event.pubkey],
    liked: actions.liked,
    reposted: actions.reposted,
    reactions: input.reactions?.[event.id],
    reposts: input.reposts?.[event.id],
  };
}

export function eventTreeListRowRenderPlan(input: {
  readonly row: EventTreeListViewRow;
  readonly continuation: EventTreeListContinuationPlan;
}): EventTreeListRowRenderPlan {
  if (input.row.kind === 'leading') return { kind: 'leading', row: input.row };
  if (input.row.kind === 'terminal') return { kind: 'terminal' };
  if (input.row.kind === 'loadingOlder') return { kind: 'loadingOlder' };
  if (input.row.kind === 'empty') return { kind: 'empty', row: input.row };
  if (input.continuation.visible)
    return { kind: 'continuation', continuation: input.continuation };
  if (input.row.kind === 'eventFragment')
    return { kind: 'eventFragment', row: input.row };
  if (input.row.kind === 'event' && 'event' in input.row.node)
    return { kind: 'event', row: input.row };
  return { kind: 'hidden' };
}
