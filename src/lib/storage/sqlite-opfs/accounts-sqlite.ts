import type { Account } from '../../accounts/account';
import type { LocalAccountSecret } from '../../accounts/local-secret-store';
import { applySqliteSchema, sendSqliteStorage } from './kernel-client';
import { throwIfProtectedStorageBlocked } from '../protected-storage-state';

const accountSchemaHash = 'accounts-sqlite-cutover';
const accountSchema = [
  `CREATE TABLE IF NOT EXISTS accounts (
  pubkey TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  signer_kind TEXT NOT NULL CHECK (signer_kind IN ('local', 'nip07', 'readonly')),
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  metadata_json TEXT NOT NULL
) STRICT;`,
  `CREATE TABLE IF NOT EXISTS local_account_secrets (
  pubkey TEXT PRIMARY KEY REFERENCES accounts(pubkey) ON DELETE CASCADE,
  secret_payload TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
) STRICT;`,
  'CREATE INDEX IF NOT EXISTS accounts_updated_at_idx ON accounts(updated_at_ms DESC);',
];

export async function sqliteReadAccounts(): Promise<Account[] | undefined> {
  if (!(await ensureAccountSchema())) return undefined;
  const response = await sendSqliteStorage(
    {
      kind: 'query',
      statement:
        'SELECT metadata_json FROM accounts ORDER BY updated_at_ms DESC, pubkey ASC;',
      rowLimit: 1000,
    },
    { deadlineMs: 10_000 },
  );
  throwIfProtectedStorageBlocked(response);
  if (response.outcome !== 'ok') return undefined;
  return response.rows.flatMap((row) => decodeJson<Account>(row.metadata_json));
}

export async function sqlitePutAccount(account: Account): Promise<boolean> {
  if (!(await ensureAccountSchema())) return false;
  const response = await sendSqliteStorage(
    {
      kind: 'execute',
      statement:
        'INSERT INTO accounts (pubkey, label, signer_kind, created_at_ms, updated_at_ms, metadata_json) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT(pubkey) DO UPDATE SET label = excluded.label, signer_kind = excluded.signer_kind, updated_at_ms = excluded.updated_at_ms, metadata_json = excluded.metadata_json;',
      params: [
        account.pubkey,
        account.label,
        account.signerType,
        account.createdAt,
        account.updatedAt,
        JSON.stringify(account),
      ],
    },
    { deadlineMs: 10_000 },
  );
  throwIfProtectedStorageBlocked(response);
  return response.outcome === 'ok';
}

export async function sqliteDeleteAccount(id: string): Promise<boolean> {
  if (!(await ensureAccountSchema())) return false;
  const response = await sendSqliteStorage(
    {
      kind: 'execute',
      statement: 'DELETE FROM accounts WHERE pubkey = ?1;',
      params: [accountIdPubkey(id)],
    },
    { deadlineMs: 10_000 },
  );
  throwIfProtectedStorageBlocked(response);
  return response.outcome === 'ok';
}

export async function sqlitePutLocalSecret(
  secret: LocalAccountSecret,
): Promise<boolean> {
  if (!(await ensureAccountSchema())) return false;
  const response = await sendSqliteStorage(
    {
      kind: 'execute',
      statement:
        'INSERT INTO local_account_secrets (pubkey, secret_payload, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(pubkey) DO UPDATE SET secret_payload = excluded.secret_payload, updated_at_ms = excluded.updated_at_ms;',
      params: [
        secret.pubkey,
        JSON.stringify(secret),
        secret.createdAt,
        secret.updatedAt,
      ],
    },
    { deadlineMs: 10_000 },
  );
  throwIfProtectedStorageBlocked(response);
  return response.outcome === 'ok';
}

export async function sqliteReadLocalSecret(
  accountId: string,
): Promise<LocalAccountSecret | undefined> {
  if (!(await ensureAccountSchema())) return undefined;
  const response = await sendSqliteStorage(
    {
      kind: 'query',
      statement:
        'SELECT secret_payload FROM local_account_secrets WHERE pubkey = ?1;',
      params: [accountIdPubkey(accountId)],
      rowLimit: 1,
    },
    { deadlineMs: 10_000 },
  );
  throwIfProtectedStorageBlocked(response);
  if (response.outcome !== 'ok') return undefined;
  return decodeJson<LocalAccountSecret>(response.rows[0]?.secret_payload)[0];
}

export async function sqliteDeleteLocalSecret(id: string): Promise<boolean> {
  if (!(await ensureAccountSchema())) return false;
  const response = await sendSqliteStorage(
    {
      kind: 'execute',
      statement: 'DELETE FROM local_account_secrets WHERE pubkey = ?1;',
      params: [accountIdPubkey(id)],
    },
    { deadlineMs: 10_000 },
  );
  throwIfProtectedStorageBlocked(response);
  return response.outcome === 'ok';
}

async function ensureAccountSchema(): Promise<boolean> {
  const response = await applySqliteSchema(accountSchemaHash, accountSchema);
  throwIfProtectedStorageBlocked(response);
  return response.outcome === 'ok';
}

function decodeJson<T>(raw: unknown): T[] {
  if (typeof raw !== 'string') return [];
  try {
    return [JSON.parse(raw) as T];
  } catch {
    return [];
  }
}

function accountIdPubkey(id: string): string {
  return id.includes(':') ? (id.split(':').at(-1) ?? id) : id;
}
