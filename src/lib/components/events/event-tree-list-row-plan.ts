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
