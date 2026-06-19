import { bestDisplayName } from '$lib/identity/display-name';
import type { ProfileSummary } from '$lib/identity/identity';
import type { ReactionGroup, RepostGroup } from '$lib/thread/thread-reactions';
import type { CustomEmoji } from '$lib/protocol';
import { openEventProfile } from './event-profile-activation';
import type { OpenProfileAction } from './action-availability';

export type ReactionActorPlan = {
  readonly pubkey: string;
  readonly name: string;
  readonly avatarUrl: string | null | undefined;
  readonly emojis: readonly CustomEmoji[];
};

export type ReactionGroupPlan = {
  readonly actors: readonly ReactionActorPlan[];
  readonly count: number;
  readonly content: string;
  readonly emoji?: CustomEmoji;
  readonly expanded: boolean;
  readonly icon: 'like' | 'dislike' | 'custom';
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly own: boolean;
};

export type RepostGroupPlan = {
  readonly actors: readonly ReactionActorPlan[];
  readonly count: number;
  readonly expanded: boolean;
  readonly id: 'reposts';
  readonly label: 'repost';
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
  readonly expanded: string;
}): ReactionSummaryPlan {
  return {
    reactions: (input.reactions ?? []).map((reaction) =>
      planReactionGroup(reaction, input),
    ),
    reactionsLabel: 'Reactions',
    reposts: planRepostGroup(input.reposts, input),
  };
}

export function toggleReactionSummary(expanded: string, id: string): string {
  return expanded === id ? '' : id;
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
): ReactionGroupPlan {
  const key = reactionGroupKey(reaction);
  const id = `reaction-${key}`;
  return {
    actors: reaction.actors.map((actor) => actorPlan(actor, input.profiles)),
    count: reaction.count,
    content: reaction.content,
    emoji: reaction.emoji,
    expanded: input.expanded === id,
    icon: reactionIcon(reaction.content),
    id,
    key,
    label: reactionLabel(reaction.content),
    own: reaction.actors.includes(input.activeAccountPubkey ?? ''),
  };
}

function planRepostGroup(
  reposts: RepostGroup | undefined,
  input: Parameters<typeof planReactionSummary>[0],
): RepostGroupPlan {
  return {
    actors: (reposts?.actors ?? []).map((actor) =>
      actorPlan(actor, input.profiles),
    ),
    count: reposts?.count ?? 0,
    expanded: input.expanded === 'reposts',
    id: 'reposts',
    label: 'repost',
    visible: Boolean(reposts && reposts.count > 0),
  };
}

function actorPlan(
  pubkey: string,
  profiles: Record<string, ProfileSummary> = {},
): ReactionActorPlan {
  const profile = profiles[pubkey];
  return {
    pubkey,
    name: bestDisplayName({ ...(profile ?? {}), pubkey }),
    avatarUrl: profile?.avatarUrl,
    emojis: profile?.customEmojis ?? [],
  };
}

function reactionGroupKey(reaction: ReactionGroup): string {
  return [
    reaction.content,
    reaction.emoji?.url ?? '',
    reaction.emoji?.address ?? '',
  ].join(':');
}

function reactionLabel(content: string): string {
  if (content === '+' || content === 'heart') return 'like';
  if (content === '-') return 'dislike';
  return content;
}

function reactionIcon(content: string): ReactionGroupPlan['icon'] {
  if (content === '+' || content === 'heart') return 'like';
  if (content === '-') return 'dislike';
  return 'custom';
}
