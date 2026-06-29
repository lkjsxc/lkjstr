import type { TweetDraft } from '../../tweet/draft-store';
import { applySqliteSchema, sendSqliteStorage } from './kernel-client';
import { throwIfProtectedStorageBlocked } from '../protected-storage-state';

const draftSchemaHash = 'tweet-drafts-sqlite-cutover';
const draftSchema = [
  `CREATE TABLE IF NOT EXISTS tweet_drafts (
  draft_id TEXT PRIMARY KEY,
  owner_pubkey TEXT,
  body TEXT NOT NULL,
  attachments_json TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL
) STRICT;`,
  'CREATE INDEX IF NOT EXISTS tweet_drafts_updated_at_idx ON tweet_drafts(updated_at_ms DESC);',
];

export async function sqliteReadTweetDraft(
  id: string,
): Promise<TweetDraft | undefined> {
  if (!(await ensureDraftSchema())) return undefined;
  const response = await sendSqliteStorage(
    {
      kind: 'query',
      statement:
        'SELECT draft_id, owner_pubkey, body, attachments_json, tags_json, updated_at_ms FROM tweet_drafts WHERE draft_id = ?1;',
      params: [id],
      rowLimit: 1,
    },
    { deadlineMs: 3_000 },
  );
  throwIfProtectedStorageBlocked(response);
  if (response.outcome !== 'ok') return undefined;
  const row = response.rows[0];
  if (!row) return undefined;
  return decodeDraft(row);
}

export async function sqlitePutTweetDraft(draft: TweetDraft): Promise<boolean> {
  if (!(await ensureDraftSchema())) return false;
  const response = await sendSqliteStorage(
    {
      kind: 'execute',
      statement:
        'INSERT INTO tweet_drafts (draft_id, owner_pubkey, body, attachments_json, tags_json, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT(draft_id) DO UPDATE SET owner_pubkey = excluded.owner_pubkey, body = excluded.body, attachments_json = excluded.attachments_json, tags_json = excluded.tags_json, updated_at_ms = excluded.updated_at_ms;',
      params: encodeDraft(draft),
    },
    { deadlineMs: 3_000 },
  );
  throwIfProtectedStorageBlocked(response);
  return response.outcome === 'ok';
}

export async function sqliteDeleteTweetDraft(id: string): Promise<boolean> {
  if (!(await ensureDraftSchema())) return false;
  const response = await sendSqliteStorage(
    {
      kind: 'execute',
      statement: 'DELETE FROM tweet_drafts WHERE draft_id = ?1;',
      params: [id],
    },
    { deadlineMs: 3_000 },
  );
  throwIfProtectedStorageBlocked(response);
  return response.outcome === 'ok';
}

async function ensureDraftSchema(): Promise<boolean> {
  const response = await applySqliteSchema(draftSchemaHash, draftSchema);
  throwIfProtectedStorageBlocked(response);
  return response.outcome === 'ok';
}

function encodeDraft(draft: TweetDraft) {
  return [
    draft.id,
    draft.accountId,
    draft.content,
    JSON.stringify(draft.attachments ?? []),
    JSON.stringify({
      customEmojis: draft.customEmojis ?? [],
      sensitive: draft.sensitive ?? false,
      contentWarningReason: draft.contentWarningReason ?? '',
    }),
    draft.updatedAt,
  ] as const;
}

function decodeDraft(row: Record<string, unknown>): TweetDraft {
  const metadata = jsonField(row, 'tags_json') as Partial<TweetDraft>;
  return {
    id: stringField(row, 'draft_id'),
    accountId: nullableStringField(row, 'owner_pubkey'),
    content: stringField(row, 'body'),
    attachments: jsonField(
      row,
      'attachments_json',
    ) as TweetDraft['attachments'],
    customEmojis: metadata.customEmojis,
    sensitive: metadata.sensitive,
    contentWarningReason: metadata.contentWarningReason,
    updatedAt: numberField(row, 'updated_at_ms'),
  };
}

function jsonField(row: Record<string, unknown>, key: string): unknown {
  return JSON.parse(stringField(row, key));
}

function stringField(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== 'string') throw new Error(`invalid draft ${key}`);
  return value;
}

function nullableStringField(
  row: Record<string, unknown>,
  key: string,
): string | null {
  const value = row[key];
  if (value === null) return null;
  if (typeof value === 'string') return value;
  throw new Error(`invalid draft ${key}`);
}

function numberField(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  if (typeof value !== 'number') throw new Error(`invalid draft ${key}`);
  return value;
}
