import type { NostrFilter } from '../protocol';
import type { PoolEvent } from '../relays/relay-pool';
import {
  relayPageDensity,
  type RelayDensityVerdict,
} from './relay-page-density';
import {
  incompleteReason,
  recordScanCoverage,
} from './relay-page-scan-diagnostics';
import { readPageDetailedCompat, statusesComplete } from './relay-page-status';
import type { RelayGroupPageRequest } from './relay-page';

export type BatchReadResult = {
  readonly events: PoolEvent[];
  readonly complete: boolean;
  readonly dense: boolean;
  readonly density: RelayDensityVerdict;
  readonly durationMs: number;
  readonly reason?: string;
};

export async function readScanBatch(
  request: RelayGroupPageRequest,
  groupKey: string,
  input: {
    readonly segmentIndex: number;
    readonly groupIndex: number;
    readonly attemptIndex: number;
    readonly batchIndex: number;
    readonly relays: readonly string[];
    readonly filters: readonly NostrFilter[];
  },
): Promise<BatchReadResult> {
  try {
    const result = await readPageDetailedCompat(request.subscriptions, {
      key: `${request.key}:${input.segmentIndex}:${input.groupIndex}:${input.attemptIndex}:${input.batchIndex}`,
      relays: input.relays,
      filters: input.filters,
      purpose: request.purpose,
    });
    const complete = statusesComplete(result.statuses);
    const density = relayPageDensity(result, input.filters, request.pageSize);
    return {
      events: result.events,
      complete,
      dense: complete && density.dense,
      density,
      durationMs: Math.max(
        0,
        ...result.statuses.map((status) => status.durationMs),
      ),
      reason: complete ? undefined : incompleteReason(result.statuses),
    };
  } catch (error) {
    await recordScanCoverage(
      request,
      groupKey,
      input.relays,
      input.filters,
      'failed',
      { reason: error instanceof Error ? error.message : 'read failed' },
    );
    throw error;
  }
}
