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
import { relayReadEventCap } from './relay-page-limits';
import { readPageDetailedCompat, statusesComplete } from './relay-page-status';
import type { ReadPageRelayStatus } from '../relays/read-page-status';
import type { RelayGroupPageRequest } from './relay-page';

export type BatchReadResult = {
  readonly events: PoolEvent[];
  readonly complete: boolean;
  readonly dense: boolean;
  readonly density: RelayDensityVerdict;
  readonly durationMs: number;
  readonly reason?: string;
  readonly statuses: ReadPageRelayStatus[];
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
    const result = await readPageDetailedCompat(
      request.subscriptions,
      {
        key: [
          request.key,
          input.segmentIndex,
          input.groupIndex,
          scanKeyPart(groupKey),
          input.attemptIndex,
          input.batchIndex,
        ].join(':'),
        relays: input.relays,
        filters: input.filters,
        purpose: request.purpose,
      },
      {
        maxEvents: relayReadEventCap(
          input.filters,
          input.relays.length,
          request.pageSize,
        ),
        signal: request.signal,
        onSnapshot: request.onSnapshot,
      },
    );
    const complete = statusesComplete(result.statuses);
    const density = relayPageDensity(result, input.filters, request.pageSize);
    return {
      events: result.events,
      complete,
      dense: density.dense,
      density,
      durationMs: Math.max(
        0,
        ...result.statuses.map((status) => status.durationMs),
      ),
      reason: complete ? undefined : incompleteReason(result.statuses),
      statuses: result.statuses,
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

function scanKeyPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'group';
}
