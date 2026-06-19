import { scanModelKey } from './scan-model-keys';
import {
  staleHalfLifeMs,
  targetDenominator,
  targetNumerator,
} from './scan-model-policy';
import type {
  ScanDensityModelRecord,
  ScanModelContext,
  ScanModelScope,
} from './scan-model-records';
import type { ScanSpanProposal } from './scan-model-proposal';

export type RustModelDto = {
  readonly semantic_feed_key: string;
  readonly route_group_key: string;
  readonly relay_url: string;
  readonly semantic_filter_key: string;
  readonly direction: 'older' | 'newer';
  readonly route_fingerprint: string;
  readonly scope: string;
  readonly density_events_per_second: number;
  readonly log_density_mean: number;
  readonly log_density_variance: number;
  readonly sample_weight: number;
  readonly complete_window_count: number;
  readonly dense_window_count: number;
  readonly sparse_window_count: number;
  readonly incomplete_window_count: number;
  readonly failure_window_count: number;
  readonly limit_hit_rate: number;
  readonly incomplete_rate: number;
  readonly last_good_span_seconds: number;
  readonly last_proposed_span_seconds: number;
  readonly updated_at_ms: number;
};

export type RustProposalDto = {
  readonly span_seconds: number;
  readonly target_count: number;
  readonly effective_limit: number;
  readonly estimated_density_events_per_second: number;
  readonly source_scope: string;
  readonly confidence: number;
  readonly cap_applied?: string;
  readonly diagnostics: readonly string[];
};

export type RustPlanOutput = {
  readonly initial_span_seconds: number;
  readonly source: string;
  readonly hint_status: 'unavailable' | 'used' | 'expired' | 'rejected';
  readonly proposal: RustProposalDto;
};

export type RustReduceOutput = {
  readonly updated_model: RustModelDto;
  readonly updated_models?: readonly RustModelDto[];
  readonly proposal: RustProposalDto;
};

export function rustModelFromRecord(row: ScanDensityModelRecord): RustModelDto {
  const density = Math.max(row.densityEventsPerSecond, 0);
  return {
    semantic_feed_key: row.semanticFeedKey,
    route_group_key: row.routeGroupKey,
    relay_url: row.relayUrl,
    semantic_filter_key: row.semanticFilterKey,
    direction: row.direction,
    route_fingerprint: row.routeFingerprint,
    scope: row.scope,
    density_events_per_second: density,
    log_density_mean: Math.log(Math.max(density, Number.MIN_VALUE)),
    log_density_variance: 0,
    sample_weight: row.sampleWeight,
    complete_window_count: row.completeWindowCount ?? 0,
    dense_window_count: row.denseWindowCount ?? 0,
    sparse_window_count: row.sparseWindowCount ?? 0,
    incomplete_window_count: row.incompleteWindowCount ?? 0,
    failure_window_count: row.failureWindowCount ?? 0,
    limit_hit_rate: row.limitHitRate ?? 0,
    incomplete_rate: row.incompleteRate ?? 0,
    last_good_span_seconds: row.lastGoodSpanSeconds ?? 0,
    last_proposed_span_seconds: row.lastProposedSpanSeconds ?? 0,
    updated_at_ms: row.updatedAtMs,
  };
}

export function modelRecordFromRust(dto: RustModelDto): ScanDensityModelRecord {
  const context = contextFromRust(dto);
  const scope = scopeFromString(dto.scope);
  return {
    ...context,
    modelKey: scanModelKey(context, scope),
    scope,
    targetLimitFraction: `${targetNumerator}/${targetDenominator}`,
    densityEventsPerSecond: dto.density_events_per_second,
    sampleWeight: dto.sample_weight,
    updatedAtMs: dto.updated_at_ms,
    decaysAfterMs: dto.updated_at_ms + staleHalfLifeMs,
    completeWindowCount: dto.complete_window_count,
    denseWindowCount: dto.dense_window_count,
    sparseWindowCount: dto.sparse_window_count,
    incompleteWindowCount: dto.incomplete_window_count,
    failureWindowCount: dto.failure_window_count,
    limitHitRate: dto.limit_hit_rate,
    incompleteRate: dto.incomplete_rate,
    lastGoodSpanSeconds: dto.last_good_span_seconds,
    lastProposedSpanSeconds: dto.last_proposed_span_seconds,
  };
}

export function proposalFromRust(
  dto: RustProposalDto,
  context: ScanModelContext,
): ScanSpanProposal {
  const sourceScope = scopeFromString(dto.source_scope);
  return {
    spanSeconds: dto.span_seconds,
    targetCount: dto.target_count,
    effectiveLimit: dto.effective_limit,
    estimatedDensityEventsPerSecond: dto.estimated_density_events_per_second,
    sourceScope,
    sourceModelKey:
      sourceScope === 'Neutral'
        ? 'neutral'
        : scanModelKey(context, sourceScope),
    confidence: dto.confidence,
    capReason: capFromString(dto.cap_applied),
  };
}

function contextFromRust(dto: RustModelDto): ScanModelContext {
  return {
    semanticFeedKey: dto.semantic_feed_key,
    routeGroupKey: dto.route_group_key,
    relayUrl: dto.relay_url,
    semanticFilterKey: dto.semantic_filter_key,
    direction: dto.direction,
    routeFingerprint: dto.route_fingerprint,
  };
}

function scopeFromString(value: string): ScanModelScope {
  if (
    value === 'Exact' ||
    value === 'RouteGroup' ||
    value === 'RelayFilter' ||
    value === 'SurfaceFilter' ||
    value === 'Surface' ||
    value === 'Global' ||
    value === 'Neutral'
  )
    return value;
  return 'Neutral';
}

function capFromString(
  value: string | undefined,
): ScanSpanProposal['capReason'] {
  if (
    value === 'increase-limited' ||
    value === 'decrease-limited' ||
    value === 'min-span' ||
    value === 'max-span'
  )
    return value;
  return undefined;
}
