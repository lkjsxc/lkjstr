import type { ParsedReaction } from '../protocol';

export const likeReactionDisplay = '❤️';

export function visibleReactionDisplay(reaction: ParsedReaction): string {
  if (reaction.kind === 'like') return likeReactionDisplay;
  return reaction.display;
}
