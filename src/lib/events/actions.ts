import {
  kinds,
  reactionTags,
  replyTags,
  repostKind,
  repostTags,
  type NostrEvent,
  type NostrTag,
  type CustomEmoji,
} from '../protocol';
import type { RelaySet } from '../relays/relay-store';
import { signAndPublish, type EventPublishStatus } from './publish-event';

export function publishReaction(
  target: NostrEvent,
  relaySets: readonly RelaySet[],
  content = '+',
  emoji?: CustomEmoji,
): Promise<EventPublishStatus> {
  return publishAction(relaySets, (pubkey, now) => ({
    pubkey,
    created_at: now,
    kind: kinds.reaction,
    tags: reactionTags(target, emoji),
    content,
  }));
}

export function publishRepost(
  target: NostrEvent,
  relaySets: readonly RelaySet[],
): Promise<EventPublishStatus> {
  return publishAction(relaySets, (pubkey, now) => ({
    pubkey,
    created_at: now,
    kind: repostKind(target),
    tags: repostTags(target),
    content: target.kind === kinds.textNote ? JSON.stringify(target) : '',
  }));
}

export function publishReply(
  target: NostrEvent,
  relaySets: readonly RelaySet[],
  content: string,
): Promise<EventPublishStatus> {
  const text = content.trim();
  if (!text) return Promise.resolve({ ok: false, message: 'Write a reply.' });
  return publishAction(relaySets, (pubkey, now) => ({
    pubkey,
    created_at: now,
    kind: kinds.textNote,
    tags: replyTags(target),
    content: text,
  }));
}

function publishAction(
  relaySets: readonly RelaySet[],
  build: (
    pubkey: string,
    now: number,
  ) => {
    pubkey: string;
    created_at: number;
    kind: number;
    tags: readonly NostrTag[];
    content: string;
  },
): Promise<EventPublishStatus> {
  return signAndPublish(
    (pubkey) => build(pubkey, Math.floor(Date.now() / 1000)),
    relaySets,
  );
}
