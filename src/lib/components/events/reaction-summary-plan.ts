import { bestDisplayName } from '$lib/identity/display-name';
import type { ProfileSummary } from '$lib/identity/identity';
import type { ReactionGroup, RepostGroup } from '$lib/thread/thread-reactions';
import type { CustomEmoji } from '$lib/protocol';
import {
  eventProfileCanOpen,
  openEventProfile,
} from './event-profile-activation';
import type { OpenProfileAction } from './action-availability';
import {
  reactionGroupKey,
  reactionSummaryCountText,
  reactionSummaryIcon,
  reactionSummaryLabel,
  reactionToggleLabel,
  repostToggleLabel,
  type ReactionSummaryIcon,
} from './reaction-summary-label-plan';

export type ReactionActorPlan = {
  readonly canOpen: boolean;
  readonly pubkey: string;
  readonly name: string;
  readonly avatarUrl: string | null | undefined;
  readonly emojis: readonly CustomEmoji[];
};

export type ReactionGroupPlan = {
  readonly actors: readonly ReactionActorPlan[];
  readonly count: number;
  readonly countText: string;
  readonly content: string;
  readonly emoji?: CustomEmoji;
  readonly expanded: boolean;
  readonly icon: ReactionSummaryIcon;
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly own: boolean;
  readonly toggleLabel: string;
};

export type RepostGroupPlan = {
  readonly actors: readonly ReactionActorPlan[];
  readonly count: number;
  readonly countText: string;
  readonly expanded: boolean;
  readonly id: 'reposts';
  readonly label: 'repost';
  readonly toggleLabel: string;
  readonly visible: boolean;
};

export type ReactionSummaryPlan = {
  readonly reactions: readonly ReactionGroupPlan[];
  readonly reactionsLabel: 'Reactions';
  readonly reposts: RepostGroupPlan;
};

export function planReactionSummary(input: {
  readonly reactions?: readonly ReactionGroup[];
  readonly reposts?: RepostGroup;
  readonly profiles?: Record<string, ProfileSummary>;
  readonly activeAccountPubkey?: string | null;
  readonly openProfile?: OpenProfileAction;
  readonly expanded: string;
}): ReactionSummaryPlan {
  const canOpenActors = canOpenReactionSummaryActors(input.openProfile);
  return {
    reactions: (input.reactions ?? []).map((reaction) =>
      planReactionGroup(reaction, input, canOpenActors),
    ),
    reactionsLabel: 'Reactions',
    reposts: planRepostGroup(input.reposts, input, canOpenActors),
  };
}

export function toggleReactionSummary(expanded: string, id: string): string {
  return expanded === id ? '' : id;
}

export function canOpenReactionSummaryActors(
  openProfile: OpenProfileAction,
): boolean {
  return eventProfileCanOpen(openProfile);
}

export function openReactionSummaryActor(
  openProfile: OpenProfileAction,
  actor: Pick<ReactionActorPlan, 'pubkey'>,
): boolean {
  return openEventProfile(openProfile, actor.pubkey);
}

function planReactionGroup(
  reaction: ReactionGroup,
  input: Parameters<typeof planReactionSummary>[0],
  canOpenActors: boolean,
): ReactionGroupPlan {
  const key = reactionGroupKey(reaction);
  const id = `reaction-${key}`;
  const expanded = input.expanded === id;
  const label = reactionSummaryLabel(reaction.content);
  return {
    actors: reaction.actors.map((actor) =>
      actorPlan(actor, input.profiles, canOpenActors),
    ),
    count: reaction.count,
    countText: reactionSummaryCountText(reaction.count),
    content: reaction.content,
    emoji: reaction.emoji,
    expanded,
    icon: reactionSummaryIcon(reaction.content),
    id,
    key,
    label,
    own: reaction.actors.includes(input.activeAccountPubkey ?? ''),
    toggleLabel: reactionToggleLabel(expanded, reaction.count, label),
  };
}

function planRepostGroup(
  reposts: RepostGroup | undefined,
  input: Parameters<typeof planReactionSummary>[0],
  canOpenActors: boolean,
): RepostGroupPlan {
  return {
    actors: (reposts?.actors ?? []).map((actor) =>
      actorPlan(actor, input.profiles, canOpenActors),
    ),
    count: reposts?.count ?? 0,
    countText: reactionSummaryCountText(reposts?.count ?? 0),
    expanded: input.expanded === 'reposts',
    id: 'reposts',
    label: 'repost',
    toggleLabel: repostToggleLabel(
      input.expanded === 'reposts',
      reposts?.count ?? 0,
    ),
    visible: Boolean(reposts && reposts.count > 0),
  };
}

function actorPlan(
  pubkey: string,
  profiles: Record<string, ProfileSummary> = {},
  canOpen: boolean,
): ReactionActorPlan {
  const profile = profiles[pubkey];
  return {
    canOpen,
    pubkey,
    name: bestDisplayName({ ...(profile ?? {}), pubkey }),
    avatarUrl: profile?.avatarUrl,
    emojis: profile?.customEmojis ?? [],
  };
}
