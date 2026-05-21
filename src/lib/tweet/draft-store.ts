import { browserDb } from '../storage/browser-db';
import {
  bestEffortStorageWrite,
  boundedStorageRead,
} from '../storage/safe-storage';
import type { CustomEmoji } from '../protocol';

export type TweetDraft = {
  readonly id: string;
  readonly accountId: string | null;
  readonly content: string;
  readonly attachments?: readonly TweetAttachment[];
  readonly customEmojis?: readonly CustomEmoji[];
  readonly sensitive?: boolean;
  readonly contentWarningReason?: string;
  readonly updatedAt: number;
};

export type TweetAttachment = {
  readonly url: string;
  readonly name: string;
  readonly type: string;
  readonly tags: readonly string[][];
  readonly imeta: readonly string[];
};

const fallback = new Map<string, TweetDraft>();

export async function loadTweetDraft(
  id = 'main',
): Promise<TweetDraft | undefined> {
  return boundedStorageRead(
    () => browserDb().tweetDrafts.get(id),
    fallback.get(id),
  );
}

export async function loadTweetDraftWithLegacy(
  id: string,
): Promise<TweetDraft | undefined> {
  return (
    (await loadTweetDraft(id)) ??
    (id === 'main' ? undefined : await loadTweetDraft())
  );
}

export function snapshotTweetDraft(
  id: string,
  content: string,
  accountId: string | null,
  attachments: readonly TweetAttachment[] = [],
  customEmojis: readonly CustomEmoji[] = [],
  sensitive = false,
  contentWarningReason = '',
): TweetDraft {
  const draft = createDraft(
    id,
    content,
    accountId,
    attachments,
    customEmojis,
    sensitive,
    contentWarningReason,
  );
  fallback.set(id, draft);
  return draft;
}

export async function saveTweetDraft(
  content: string,
  accountId: string | null,
  attachments: readonly TweetAttachment[] = [],
  customEmojis: readonly CustomEmoji[] = [],
  sensitive = false,
  contentWarningReason = '',
  id = 'main',
): Promise<TweetDraft> {
  const draft = createDraft(
    id,
    content,
    accountId,
    attachments,
    customEmojis,
    sensitive,
    contentWarningReason,
  );
  fallback.set(id, draft);
  await bestEffortStorageWrite(() => browserDb().tweetDrafts.put(draft));
  return draft;
}

function createDraft(
  id: string,
  content: string,
  accountId: string | null,
  attachments: readonly TweetAttachment[],
  customEmojis: readonly CustomEmoji[],
  sensitive: boolean,
  contentWarningReason: string,
): TweetDraft {
  return {
    id,
    accountId,
    content,
    attachments,
    customEmojis,
    sensitive,
    contentWarningReason,
    updatedAt: Date.now(),
  };
}

export async function clearTweetDraft(id = 'main'): Promise<void> {
  fallback.delete(id);
  await bestEffortStorageWrite(() => browserDb().tweetDrafts.delete(id));
}
