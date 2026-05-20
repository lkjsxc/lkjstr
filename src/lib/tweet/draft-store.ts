import { browserDb } from '../storage/browser-db';
import {
  bestEffortStorageWrite,
  boundedStorageRead,
} from '../storage/safe-storage';

export type TweetDraft = {
  readonly id: string;
  readonly accountId: string | null;
  readonly content: string;
  readonly attachments?: readonly TweetAttachment[];
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

export async function saveTweetDraft(
  content: string,
  accountId: string | null,
  attachments: readonly TweetAttachment[] = [],
  id = 'main',
): Promise<TweetDraft> {
  const draft = { id, accountId, content, attachments, updatedAt: Date.now() };
  fallback.set(id, draft);
  await bestEffortStorageWrite(() => browserDb().tweetDrafts.put(draft));
  return draft;
}

export async function clearTweetDraft(id = 'main'): Promise<void> {
  fallback.delete(id);
  await bestEffortStorageWrite(() => browserDb().tweetDrafts.delete(id));
}
