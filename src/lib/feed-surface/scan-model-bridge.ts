import type { ScanModelObservation } from './scan-model-observation';
import type {
  ScanDensityModelRecord,
  ScanModelContext,
} from './scan-model-records';
import type { ScanSpanProposal } from './scan-model-proposal';
import {
  modelRecordFromRust,
  proposalFromRust,
  rustModelFromRecord,
  type RustPlanOutput,
  type RustReduceOutput,
} from './scan-model-dto';
import { loadScanModelWasmPlanner } from './scan-model-wasm';

export type ScanBridgeResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly message: string };

export type ScanPlanBridgeValue = {
  readonly proposal: ScanSpanProposal;
  readonly raw: RustPlanOutput;
};

export type ScanReduceBridgeValue = {
  readonly proposal: ScanSpanProposal;
  readonly updatedModels: readonly ScanDensityModelRecord[];
  readonly raw: RustReduceOutput;
};

export type ScanBridgePlanInput = {
  readonly context: ScanModelContext;
  readonly models: readonly ScanDensityModelRecord[];
  readonly effectiveLimit: number;
  readonly requestedLimit: number;
  readonly pageSize: number;
  readonly previousSpanSeconds?: number;
  readonly edgeSeconds: number;
  readonly edgeId: string;
  readonly nowMs: number;
};

export async function planScanSpanWithRust(
  input: ScanBridgePlanInput,
): Promise<ScanBridgeResult<ScanPlanBridgeValue>> {
  const planner = await loadScanModelWasmPlanner();
  if (!planner.ok) return { ok: false, message: planner.message };
  const planned = planner.value.plan<RustPlanOutput>(rustPlanInput(input));
  if (!planned.ok) return { ok: false, message: planned.message };
  return {
    ok: true,
    value: {
      raw: planned.value,
      proposal: proposalFromRust(planned.value.proposal, input.context),
    },
  };
}

export async function reduceScanObservationWithRust(input: {
  readonly plan: ScanBridgePlanInput;
  readonly observation: ScanModelObservation;
}): Promise<ScanBridgeResult<ScanReduceBridgeValue>> {
  const planner = await loadScanModelWasmPlanner();
  if (!planner.ok) return { ok: false, message: planner.message };
  const reduced = planner.value.reduce<RustReduceOutput>({
    plan: rustPlanInput(input.plan),
    observation: rustObservation(input.observation),
  });
  if (!reduced.ok) return { ok: false, message: reduced.message };
  const models = reduced.value.updated_models ?? [reduced.value.updated_model];
  return {
    ok: true,
    value: {
      raw: reduced.value,
      updatedModels: models.map(modelRecordFromRust),
      proposal: proposalFromRust(reduced.value.proposal, input.plan.context),
    },
  };
}

function rustPlanInput(input: ScanBridgePlanInput) {
  return {
    semantic_feed_key: input.context.semanticFeedKey,
    route_group_key: input.context.routeGroupKey,
    relay_url: input.context.relayUrl,
    semantic_filter_key: input.context.semanticFilterKey,
    direction: input.context.direction,
    route_fingerprint: input.context.routeFingerprint,
    visible_edge: {
      created_at_seconds: input.edgeSeconds,
      event_id: input.edgeId,
    },
    now_seconds: Math.floor(input.nowMs / 1000),
    page_size: clampU16(input.pageSize),
    requested_limit: clampU16(input.requestedLimit),
    effective_limit: clampU16(input.effectiveLimit),
    previous_hint: input.previousSpanSeconds
      ? {
          next_span_seconds: Math.max(1, Math.floor(input.previousSpanSeconds)),
        }
      : undefined,
    scan_models: input.models.map(rustModelFromRecord),
  };
}

function rustObservation(observation: ScanModelObservation) {
  return {
    semantic_feed_key: observation.semanticFeedKey,
    route_group_key: observation.routeGroupKey,
    relay_url: observation.relayUrl,
    semantic_filter_key: observation.semanticFilterKey,
    direction: observation.direction,
    route_fingerprint: observation.routeFingerprint,
    since_seconds: observation.sinceSeconds,
    until_seconds: observation.untilSeconds,
    requested_limit: clampU16(observation.requestedLimit),
    effective_limit: clampU16(observation.effectiveLimit),
    event_count: clampU16(observation.eventCount),
    unique_event_count: clampU16(observation.uniqueEventCount),
    final_visible_count: clampU16(observation.finalVisibleCount),
    event_limit_reached: observation.eventLimitReached,
    eose: observation.eose,
    timeout: observation.timeout,
    closed: observation.closed,
    auth: observation.auth,
    socket_error: observation.socketError,
    bytes_sent: 0,
    bytes_received: 0,
    started_at_ms: observation.startedAtMs,
    completed_at_ms: observation.completedAtMs,
  };
}

function clampU16(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(65_535, Math.max(0, Math.floor(value)));
}
