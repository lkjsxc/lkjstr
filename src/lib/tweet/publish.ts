import { kinds, type NostrTag } from '../protocol';
import {
  signAndPublish,
  type EventPublishStatus,
} from '../events/publish-event';
import type { RelaySet } from '../relays/relay-store';

export type TweetPublishStatus = EventPublishStatus;

export async function publishTweet(
  content: string,
  relaySets: readonly RelaySet[],
  tags: readonly NostrTag[] = [],
): Promise<TweetPublishStatus> {
  const text = content.trim();
  if (!text) return { ok: false, message: 'Write a note before publishing.' };
  return signAndPublish(
    (pubkey) => ({
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      kind: kinds.textNote,
      tags,
      content: text,
    }),
    relaySets,
  );
}
