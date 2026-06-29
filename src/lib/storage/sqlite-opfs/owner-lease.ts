import {
  announceSqliteOwnerHeld,
  lookupSqliteOwnerHolder,
} from './owner-coordination';
import type { StorageDiagnostics, StorageOutcome } from './types';

export const sqliteOwnerLockName = 'lkjstr.sqlite-opfs-owner';
export const sqliteOwnerCooldownMs = 2_000;

type LockManagerLike = {
  readonly request: (
    name: string,
    options: { readonly mode: 'exclusive'; readonly ifAvailable: true },
    callback: (lock: unknown) => Promise<void> | void,
  ) => Promise<unknown>;
};

export type SqliteOpfsOwnerLease = {
  readonly diagnostics: StorageDiagnostics;
  release: () => void;
};

export type SqliteOpfsOwnerLeaseDenied = {
  readonly outcome: Extract<StorageOutcome, 'busy' | 'blocked' | 'unavailable'>;
  readonly diagnostics: StorageDiagnostics;
};

export type SqliteOpfsOwnerLeaseResult =
  | { readonly ok: true; readonly lease: SqliteOpfsOwnerLease }
  | { readonly ok: false; readonly denied: SqliteOpfsOwnerLeaseDenied };

export function acquireSqliteOpfsOwnerLease(): Promise<SqliteOpfsOwnerLeaseResult> {
  const locks = lockManager();
  if (!locks) return Promise.resolve(denied('blocked', 'web-lock-unavailable'));
  return new Promise((resolve) => {
    let settled = false;
    let releaseHeld!: () => void;
    const held = new Promise<void>((release) => (releaseHeld = release));
    const settle = (result: SqliteOpfsOwnerLeaseResult): void => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    void locks
      .request(
        sqliteOwnerLockName,
        { mode: 'exclusive', ifAvailable: true },
        (lock) => {
          if (!lock) {
            return lookupSqliteOwnerHolder().then((holderId) => {
              settle(denied('busy', 'web-lock-held', holderId));
            });
          }
          const coordination = announceSqliteOwnerHeld();
          let released = false;
          settle({
            ok: true,
            lease: {
              diagnostics: {
                storageOwner: 'active',
                ownerReason: 'web-lock-granted',
                retryAfterMs: null,
                ownerHolderId: coordination.holderId,
              },
              release: () => {
                if (released) return;
                released = true;
                coordination.close();
                releaseHeld();
              },
            },
          });
          return held;
        },
      )
      .catch(() => settle(denied('unavailable', 'worker-open-failed')));
  });
}

function denied(
  outcome: SqliteOpfsOwnerLeaseDenied['outcome'],
  reason: NonNullable<StorageDiagnostics['ownerReason']>,
  holderId?: string,
): SqliteOpfsOwnerLeaseResult {
  return {
    ok: false,
    denied: {
      outcome,
      diagnostics: {
        storageOwner: outcome === 'busy' ? 'busy' : 'unavailable',
        ownerReason: reason,
        retryAfterMs: sqliteOwnerCooldownMs,
        ownerHolderId: holderId,
        message: ownerMessage(reason, holderId),
      },
    },
  };
}

function ownerMessage(
  reason: NonNullable<StorageDiagnostics['ownerReason']>,
  holderId?: string,
): string {
  if (reason === 'web-lock-held')
    return holderId
      ? `SQLite OPFS storage is open in another tab (${holderId}).`
      : 'SQLite OPFS storage is open in another tab.';
  if (reason === 'web-lock-unavailable')
    return 'Web Locks are unavailable for SQLite OPFS ownership.';
  return 'SQLite OPFS owner lease could not be acquired.';
}

function lockManager(): LockManagerLike | undefined {
  const navigatorLike = globalThis.navigator as
    | (Navigator & { readonly locks?: LockManagerLike })
    | undefined;
  return typeof navigatorLike?.locks?.request === 'function'
    ? navigatorLike.locks
    : undefined;
}
