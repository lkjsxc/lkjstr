import type { TweetDraft } from '../../tweet/draft-store';
import {
  sqliteDeleteTweetDraft,
  sqlitePutTweetDraft,
  sqliteReadTweetDraft,
} from '../sqlite-opfs/tweet-drafts-sqlite';

const memoryDrafts = new Map<string, TweetDraft>();

export async function readTweetDraftRow(
  id: string,
  fallback: TweetDraft | undefined,
): Promise<TweetDraft | undefined> {
  const row = await sqliteReadTweetDraft(id).catch(() => undefined);
  const draft = row ?? memoryDrafts.get(id) ?? fallback;
  if (draft) memoryDrafts.set(id, draft);
  return draft;
}

export async function putTweetDraftRow(draft: TweetDraft): Promise<void> {
  memoryDrafts.set(draft.id, draft);
  await sqlitePutTweetDraft(draft).catch(() => false);
}

export async function deleteTweetDraftRow(id: string): Promise<void> {
  memoryDrafts.delete(id);
  await sqliteDeleteTweetDraft(id).catch(() => false);
}
