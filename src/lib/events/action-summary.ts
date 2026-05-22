import { kinds, parseReaction, tagValues, type NostrEvent } from '../protocol';

export type ActionSummary = {
  readonly verb: string;
  readonly detail?: string;
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
  return kind ? ` kind ${kind}` : ' an event';
}

function reactionSummary(event: NostrEvent): ActionSummary {
  const reaction = parseReaction(event);
  if (reaction.kind === 'like') return { verb: 'liked' };
  if (reaction.kind === 'dislike') return { verb: 'disliked' };
  return { verb: 'reacted with', detail: reaction.display };
}
