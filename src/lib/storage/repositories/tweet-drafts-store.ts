import type { TweetDraft } from '../../tweet/draft-store';
import {
  sqliteDeleteTweetDraft,
  sqlitePutTweetDraft,
  sqliteReadTweetDraft,
} from '../sqlite-opfs/tweet-drafts-sqlite';
import { protectedStorageStateFromError } from '../protected-storage-state';

const memoryDrafts = new Map<string, TweetDraft>();

export async function readTweetDraftRow(
  id: string,
  fallback: TweetDraft | undefined,
): Promise<TweetDraft | undefined> {
  const row = await sqliteReadTweetDraft(id).catch(undefinedUnlessProtected);
  const draft = row ?? memoryDrafts.get(id) ?? fallback;
  if (draft) memoryDrafts.set(id, draft);
  return draft;
}

export async function putTweetDraftRow(draft: TweetDraft): Promise<void> {
  memoryDrafts.set(draft.id, draft);
  await sqlitePutTweetDraft(draft).catch(undefinedUnlessProtected);
}

export async function deleteTweetDraftRow(id: string): Promise<void> {
  memoryDrafts.delete(id);
  await sqliteDeleteTweetDraft(id).catch(undefinedUnlessProtected);
}

function undefinedUnlessProtected(error: unknown): undefined {
  if (protectedStorageStateFromError(error)) throw error;
  return undefined;
}
