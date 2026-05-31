import type { TweetDraft } from '../../tweet/draft-store';
import { browserDb } from '../browser-db';
import {
  bestEffortStorageWrite,
  boundedStorageRead,
} from '../safe-storage';

export async function readTweetDraftRow(
  id: string,
  fallback: TweetDraft | undefined,
): Promise<TweetDraft | undefined> {
  return boundedStorageRead(() => browserDb().tweetDrafts.get(id), fallback);
}

export async function putTweetDraftRow(draft: TweetDraft): Promise<void> {
  await bestEffortStorageWrite(() => browserDb().tweetDrafts.put(draft));
}

export async function deleteTweetDraftRow(id: string): Promise<void> {
  await bestEffortStorageWrite(() => browserDb().tweetDrafts.delete(id));
}
