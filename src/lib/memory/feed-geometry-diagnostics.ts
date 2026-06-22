import { rustWasmDiagnosticMessage } from '$lib/rust-wasm/bridge-unavailable';
import { loadLkjstrWebWasm } from 'virtual:lkjstr-web-wasm';

export type FeedGeometryRuntimeDiagnostics =
  | {
      readonly status: 'available';
      readonly estimates: number;
      readonly measurementUpdates: number;
      readonly reservations: number;
      readonly fragmentPlans: number;
      readonly anchorCaptures: number;
      readonly anchorReconciles: number;
      readonly errors: number;
    }
  | {
      readonly status: 'unavailable';
      readonly reason: string;
      readonly estimates: 0;
      readonly measurementUpdates: 0;
      readonly reservations: 0;
      readonly fragmentPlans: 0;
      readonly anchorCaptures: 0;
      readonly anchorReconciles: 0;
      readonly errors: 0;
    };

type FeedGeometryDiagnosticsExports = {
  readonly feed_geometry_runtime_snapshot?: () => unknown;
};

export function unavailableFeedGeometryDiagnostics(
  reason: string,
): FeedGeometryRuntimeDiagnostics {
  return {
    status: 'unavailable',
    reason,
    estimates: 0,
    measurementUpdates: 0,
    reservations: 0,
    fragmentPlans: 0,
    anchorCaptures: 0,
    anchorReconciles: 0,
    errors: 0,
  };
}

export async function readFeedGeometryDiagnostics(): Promise<FeedGeometryRuntimeDiagnostics> {
  try {
    const module =
      (await loadLkjstrWebWasm()) as FeedGeometryDiagnosticsExports;
    const read = module.feed_geometry_runtime_snapshot;
    if (!read) {
      return unavailableFeedGeometryDiagnostics(
        'Rust feed geometry diagnostics export unavailable.',
      );
    }
    return normalizeFeedGeometryDiagnostics(read());
  } catch (error) {
    return unavailableFeedGeometryDiagnostics(rustWasmDiagnosticMessage(error));
  }
}

export function normalizeFeedGeometryDiagnostics(
  value: unknown,
): FeedGeometryRuntimeDiagnostics {
  if (!isRecord(value) || value.status !== 'available') {
    return unavailableFeedGeometryDiagnostics(
      'Rust feed geometry diagnostics snapshot malformed.',
    );
  }
  return {
    status: 'available',
    estimates: count(value.estimates),
    measurementUpdates: count(value.measurement_updates),
    reservations: count(value.reservations),
    fragmentPlans: count(value.fragment_plans),
    anchorCaptures: count(value.anchor_captures),
    anchorReconciles: count(value.anchor_reconciles),
    errors: count(value.errors),
  };
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
