import { appendAppLog } from '../../log/app-log';
import type { StartupStorageDiagnostics } from './startup-diagnostics-model';

const loggedRows = new Set<string>();

export function logStartupStorageDiagnostics(
  snapshot: StartupStorageDiagnostics,
): void {
  for (const row of snapshot.rows) {
    if (row.status === 'ok') continue;
    const key = `${row.key}:${row.reason}`;
    if (loggedRows.has(key)) continue;
    loggedRows.add(key);
    appendAppLog({
      area: 'storage',
      severity: 'warn',
      code: `startup-${row.key}`,
      message: `${row.label}: ${row.reason}`,
      context: { reason: row.reason, probe: row.key },
    });
  }
}
