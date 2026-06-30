import type { SqlParams, StorageOp, StorageResponse } from './types';

export type StartupStorageProbeStatus = 'ok' | 'unavailable';
export type StartupStorageProbeKey =
  | 'broker'
  | 'storage-health'
  | 'accounts'
  | 'active-selector'
  | 'relay-settings'
  | 'profile-headers';

export type StartupStorageProbe = {
  readonly key: StartupStorageProbeKey;
  readonly label: string;
  readonly status: StartupStorageProbeStatus;
  readonly reason: string;
  readonly count?: number;
  readonly detail?: string;
};

export type StartupStorageDiagnostics = {
  readonly updatedAt: number;
  readonly rows: readonly StartupStorageProbe[];
};

export type StartupBroker = {
  readonly workerUrl?: string;
  readonly databaseName?: string;
  send(
    op: StorageOp,
    options?: { readonly deadlineMs?: number },
  ): Promise<StorageResponse>;
};

export type CountProbe = {
  readonly key: StartupStorageProbeKey;
  readonly label: string;
  readonly table: string;
  readonly statement: string;
  readonly params?: SqlParams;
};

const selectorKey = 'accounts.activeAccountSelector';

export const startupCountProbes: readonly CountProbe[] = [
  countProbe(
    'accounts',
    'Accounts rows',
    'accounts',
    'SELECT COUNT(*) AS count FROM accounts;',
  ),
  countProbe(
    'active-selector',
    'Active account selector row',
    'settings',
    'SELECT COUNT(*) AS count FROM settings WHERE key = ?1;',
    [selectorKey],
  ),
  countProbe(
    'relay-settings',
    'Relay settings rows',
    'relay_sets',
    'SELECT COUNT(*) AS count FROM relay_sets;',
  ),
  countProbe(
    'profile-headers',
    'Profile header cache rows',
    'events',
    'SELECT COUNT(*) AS count FROM events WHERE kind = 0;',
  ),
];

export function okProbe(
  key: StartupStorageProbeKey,
  label: string,
  reason: string,
  detail?: string,
  count?: number,
): StartupStorageProbe {
  return { key, label, status: 'ok', reason, detail, count };
}

export function unavailableProbe(
  key: StartupStorageProbeKey,
  label: string,
  reason: string,
): StartupStorageProbe {
  return { key, label, status: 'unavailable', reason };
}

export function diagnostics(
  rows: readonly StartupStorageProbe[],
): StartupStorageDiagnostics {
  return { updatedAt: Date.now(), rows };
}

function countProbe(
  key: StartupStorageProbeKey,
  label: string,
  table: string,
  statement: string,
  params?: SqlParams,
): CountProbe {
  return { key, label, table, statement, params };
}
