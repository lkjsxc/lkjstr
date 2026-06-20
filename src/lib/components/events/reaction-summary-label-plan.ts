import type { ReactionGroup } from '$lib/thread/thread-reactions';

export type ReactionSummaryIcon = 'like' | 'dislike' | 'custom';

export function reactionGroupKey(
  reaction: Pick<ReactionGroup, 'content' | 'emoji'>,
): string {
  return [
    reaction.content,
    reaction.emoji?.url ?? '',
    reaction.emoji?.address ?? '',
  ].join(':');
}

export function reactionSummaryLabel(content: string): string {
  if (content === '+' || content === 'heart') return 'like';
  if (content === '-') return 'dislike';
  return content;
}

export function reactionSummaryIcon(content: string): ReactionSummaryIcon {
  if (content === '+' || content === 'heart') return 'like';
  if (content === '-') return 'dislike';
  return 'custom';
}

export function reactionSummaryCountText(count: number): string {
  return String(count);
}

export function reactionToggleLabel(
  expanded: boolean,
  count: number,
  label: string,
): string {
  return `${expanded ? 'Hide' : 'Show'} ${count} ${label} ${plural(
    count,
    'reaction',
  )}`;
}

export function repostToggleLabel(expanded: boolean, count: number): string {
  return `${expanded ? 'Hide' : 'Show'} ${count} ${plural(count, 'repost')}`;
}

function plural(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}
