// The name of a feed's tab, from what it shows.
import type { Row } from '../engine/protocol.ts';
import { channelName } from './channel-parts.ts';
import { plainName } from './parts.ts';
import type { ViewEnv } from './registry.ts';

/** The person of a profile, the channel, the author of a thread's focused note, the hashtag, the search words;
 * otherwise the title the tab was opened with. */
export function feedTitle(
  kind: string,
  rows: readonly Row[],
  state: { tag?: string; text?: string; title?: string },
): string | undefined {
  const head = rows[0];
  if (head?.kind === 'profile') return plainName(head.author);
  if (head?.kind === 'channel') return head.name.trim() ? channelName(head) : state.title;
  const focus = rows.find((r) => r.kind === 'note' && r.thread?.role === 'focus');
  if (focus?.kind === 'note') return plainName(focus.author);
  if (kind === 'hashtag') return `#${state.tag ?? ''}`;
  return kind === 'search' && state.text ? state.text : state.title;
}

/** Names the tab, and keeps the name with it for the next first frame. */
export function showFeedTitle(
  env: Pick<ViewEnv, 'setTitle'>,
  next: string | undefined,
  state: { title?: string },
  save: () => void,
): void {
  if (!next) return;
  if (next !== state.title) (state.title = next), save();
  env.setTitle(next);
}
