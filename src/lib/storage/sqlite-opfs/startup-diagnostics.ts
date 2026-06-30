import {
  sqliteOpfsBrokerGlobalName,
  sqliteProductDatabaseName,
  sqliteProductWorkerUrl,
} from './product-key';
import { logStartupStorageDiagnostics } from './startup-diagnostics-log';
import {
  diagnostics,
  okProbe,
  startupCountProbes,
  type CountProbe,
  type StartupBroker,
  type StartupStorageDiagnostics,
  type StartupStorageProbe,
  unavailableProbe,
} from './startup-diagnostics-model';
import type { StorageResponse } from './types';

export type {
  StartupStorageDiagnostics,
  StartupStorageProbe,
} from './startup-diagnostics-model';

let latest: StartupStorageDiagnostics = { updatedAt: 0, rows: [] };

export function startupStorageDiagnostics(): StartupStorageDiagnostics {
  return latest;
}

export async function readStartupStorageDiagnostics(
  broker: unknown = globalBroker(),
): Promise<StartupStorageDiagnostics> {
  const rows: StartupStorageProbe[] = [];
  if (!isBroker(broker))
    return diagnostics([
      unavailableProbe('broker', 'App broker', 'broker-missing'),
    ]);
  const mismatch = brokerKeyMismatch(broker);
  if (mismatch)
    return diagnostics([unavailableProbe('broker', 'App broker', mismatch)]);
  rows.push(okProbe('broker', 'App broker', 'broker-installed'));
  const health = await broker.send(
    { kind: 'get-storage-health' },
    { deadlineMs: 3_000 },
  );
  rows.push(healthRow(health));
  for (const probe of startupCountProbes)
    rows.push(await countRow(broker, probe));
  return diagnostics(rows);
}

export async function refreshStartupStorageDiagnostics(): Promise<StartupStorageDiagnostics> {
  latest = await readStartupStorageDiagnostics();
  logStartupStorageDiagnostics(latest);
  return latest;
}

function globalBroker(): unknown {
  return (globalThis as Record<string, unknown>)[sqliteOpfsBrokerGlobalName];
}

function isBroker(value: unknown): value is StartupBroker {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as StartupBroker).send === 'function'
  );
}

function brokerKeyMismatch(broker: StartupBroker): string | undefined {
  return broker.workerUrl === sqliteProductWorkerUrl &&
    broker.databaseName === sqliteProductDatabaseName
    ? undefined
    : 'broker-key-mismatch';
}

function healthRow(response: StorageResponse): StartupStorageProbe {
  const health = response.diagnostics.health;
  if (response.outcome !== 'ok')
    return unavailableProbe(
      'storage-health',
      'Storage health',
      responseReason(response),
    );
  return okProbe(
    'storage-health',
    'Storage health',
    'open',
    health?.mode ?? response.diagnostics.mode,
  );
}

async function countRow(
  broker: StartupBroker,
  probe: CountProbe,
): Promise<StartupStorageProbe> {
  if (!(await tableExists(broker, probe.table)))
    return unavailableProbe(
      probe.key,
      probe.label,
      `${probe.table}-table-missing`,
    );
  const response = await broker.send(
    {
      kind: 'query',
      statement: probe.statement,
      params: probe.params,
      rowLimit: 1,
    },
    { deadlineMs: 2_000 },
  );
  if (response.outcome !== 'ok')
    return unavailableProbe(probe.key, probe.label, responseReason(response));
  const count = countValue(response.rows[0]?.count);
  return okProbe(
    probe.key,
    probe.label,
    'read-ok',
    count === undefined ? undefined : `${count} row(s)`,
    count,
  );
}

async function tableExists(
  broker: StartupBroker,
  table: string,
): Promise<boolean> {
  const response = await broker.send(
    {
      kind: 'query',
      statement:
        "SELECT COUNT(*) AS count FROM sqlite_schema WHERE type = 'table' AND name = ?1;",
      params: [table],
      rowLimit: 1,
    },
    { deadlineMs: 2_000 },
  );
  return response.outcome === 'ok' && countValue(response.rows[0]?.count) === 1;
}

function responseReason(response: StorageResponse): string {
  return (
    response.diagnostics.ownerReason ??
    response.diagnostics.message ??
    response.outcome
  );
}

function countValue(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') return Number.parseInt(value, 10);
  return undefined;
}
