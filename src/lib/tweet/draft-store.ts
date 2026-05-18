import { browserDb } from '../storage/browser-db';

export type TweetDraft = {
  readonly id: string;
  readonly accountId: string | null;
  readonly content: string;
  readonly updatedAt: number;
};

const fallback = new Map<string, TweetDraft>();

export async function loadTweetDraft(
  id = 'main',
): Promise<TweetDraft | undefined> {
  return browserDb()
    .tweetDrafts.get(id)
    .catch(() => fallback.get(id));
}

export async function saveTweetDraft(
  content: string,
  accountId: string | null,
  id = 'main',
): Promise<TweetDraft> {
  const draft = { id, accountId, content, updatedAt: Date.now() };
  fallback.set(id, draft);
  await browserDb()
    .tweetDrafts.put(draft)
    .catch(() => undefined);
  return draft;
}

export async function clearTweetDraft(id = 'main'): Promise<void> {
  fallback.delete(id);
  await browserDb()
    .tweetDrafts.delete(id)
    .catch(() => undefined);
}
