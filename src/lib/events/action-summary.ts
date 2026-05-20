import { kinds, tagValues, type NostrEvent } from '../protocol';

export type ActionSummary = {
  readonly verb: string;
  readonly detail?: string;
};

export function actionSummary(event: NostrEvent): ActionSummary | undefined {
  if (event.kind === kinds.repost) return { verb: 'reposted' };
  if (event.kind === kinds.reaction) return reactionSummary(event);
  if (event.kind === kinds.deletion)
    return { verb: 'deleted a referenced event' };
  if (event.kind === kinds.zapReceipt) return { verb: 'zapped this event' };
  return undefined;
}

function reactionSummary(event: NostrEvent): ActionSummary {
  const content = event.content.trim();
  if (!content || content === '+') return { verb: 'reacted' };
  const emoji = tagValues(event, 'emoji').find((shortcode) =>
    content.includes(`:${shortcode}:`),
  );
  if (emoji) return { verb: 'reacted with', detail: `:${emoji}:` };
  return { verb: 'reacted with', detail: content };
}
