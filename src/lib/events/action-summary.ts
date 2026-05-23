import {
  kinds,
  parseReaction,
  tagValues,
  type NostrEvent,
  type ParsedReaction,
} from '../protocol';
import { visibleReactionDisplay } from './reaction-display';

export type ActionSummary = {
  readonly verb: string;
  readonly detail?: string;
  readonly reaction?: ParsedReaction;
};

export function actionSummary(event: NostrEvent): ActionSummary | undefined {
  if (event.kind === kinds.repost) return { verb: 'reposted' };
  if (event.kind === kinds.genericRepost)
    return { verb: 'reposted', detail: genericTarget(event) };
  if (event.kind === kinds.reaction) return reactionSummary(event);
  if (event.kind === kinds.deletion)
    return { verb: 'deleted a referenced event' };
  if (event.kind === kinds.zapReceipt) return { verb: 'zapped this event' };
  return undefined;
}

function genericTarget(event: NostrEvent): string {
  const kind = tagValues(event, 'k')[0];
  return kind ? `kind ${kind}` : 'an event';
}

function reactionSummary(event: NostrEvent): ActionSummary {
  const reaction = parseReaction(event);
  if (reaction.kind === 'like')
    return {
      verb: 'reacted with',
      detail: visibleReactionDisplay(reaction),
      reaction,
    };
  if (reaction.kind === 'dislike') return { verb: 'disliked', reaction };
  return {
    verb: 'reacted with',
    detail: visibleReactionDisplay(reaction),
    reaction,
  };
}
