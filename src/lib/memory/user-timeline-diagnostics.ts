import { loadLkjstrWebWasm } from 'virtual:lkjstr-web-wasm';

export type RuntimeDiagnosticCount = {
  readonly key: string;
  readonly count: number;
};

export type UserTimelineRuntimeDiagnostics =
  | {
      readonly status: 'available';
      readonly outcomes: readonly RuntimeDiagnosticCount[];
      readonly reasons: readonly RuntimeDiagnosticCount[];
    }
  | {
      readonly status: 'unavailable';
      readonly reason: string;
      readonly outcomes: readonly RuntimeDiagnosticCount[];
      readonly reasons: readonly RuntimeDiagnosticCount[];
    };

type UserTimelineDiagnosticsExports = {
  readonly user_timeline_diagnostics_snapshot?: () => unknown;
};

export function unavailableUserTimelineDiagnostics(
  reason: string,
): UserTimelineRuntimeDiagnostics {
  return {
    status: 'unavailable',
    reason,
    outcomes: [],
    reasons: [],
  };
}

export async function readUserTimelineDiagnostics(): Promise<UserTimelineRuntimeDiagnostics> {
  try {
    const module = (await loadLkjstrWebWasm()) as UserTimelineDiagnosticsExports;
    const read = module.user_timeline_diagnostics_snapshot;
    if (!read) {
      return unavailableUserTimelineDiagnostics(
        'Rust User Timeline diagnostics export unavailable.',
      );
    }
    return normalizeUserTimelineDiagnostics(read());
  } catch (error) {
    return unavailableUserTimelineDiagnostics(
      error instanceof Error ? error.message : String(error),
    );
  }
}

export function normalizeUserTimelineDiagnostics(
  value: unknown,
): UserTimelineRuntimeDiagnostics {
  if (!isRecord(value) || value.status !== 'available') {
    return unavailableUserTimelineDiagnostics(
      'Rust User Timeline diagnostics snapshot malformed.',
    );
  }
  return {
    status: 'available',
    outcomes: countRows(value.outcomes),
    reasons: countRows(value.reasons),
  };
}

function countRows(value: unknown): readonly RuntimeDiagnosticCount[] {
  return Array.isArray(value)
    ? value
        .map(countRow)
        .filter((row): row is RuntimeDiagnosticCount => Boolean(row))
    : [];
}

function countRow(value: unknown): RuntimeDiagnosticCount | undefined {
  if (!isRecord(value) || typeof value.key !== 'string') return undefined;
  return typeof value.count === 'number' && Number.isFinite(value.count)
    ? { key: value.key, count: Math.max(0, Math.trunc(value.count)) }
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
