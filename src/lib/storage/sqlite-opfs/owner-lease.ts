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
            settle(denied('busy', 'web-lock-held'));
            return undefined;
          }
          let released = false;
          settle({
            ok: true,
            lease: {
              diagnostics: {
                storageOwner: 'active',
                ownerReason: 'web-lock-granted',
                retryAfterMs: null,
              },
              release: () => {
                if (released) return;
                released = true;
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
): SqliteOpfsOwnerLeaseResult {
  return {
    ok: false,
    denied: {
      outcome,
      diagnostics: {
        storageOwner: outcome === 'busy' ? 'busy' : 'unavailable',
        ownerReason: reason,
        retryAfterMs: sqliteOwnerCooldownMs,
        message: ownerMessage(reason),
      },
    },
  };
}

function ownerMessage(
  reason: NonNullable<StorageDiagnostics['ownerReason']>,
): string {
  if (reason === 'web-lock-held')
    return 'SQLite OPFS storage is open in another tab.';
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
