import {
  relaySegmentInitialSpan,
  relaySegmentMaxSpan,
  relaySegmentMinSpan,
} from '$lib/events/relay-page-segments';
import type { ScanDensityModelRecord, ScanModelScope } from './scan-model-records';

export const targetNumerator = 2;
export const targetDenominator = 3;
export const maxChangeFactor = 4;
export const staleHalfLifeMs = 7 * 24 * 60 * 60 * 1000;
export const minimumDensity = 1 / relaySegmentMaxSpan;
export const neutralPriorWeight = 0.001;
export const neutralSpanSeconds = relaySegmentInitialSpan;

export function targetLimitCount(limit: number): number {
  return Math.max(
    1,
    Math.floor((Math.max(1, limit) * targetNumerator) / targetDenominator),
  );
}

export function clampSpan(value: number): number {
  return Math.min(
    relaySegmentMaxSpan,
    Math.max(relaySegmentMinSpan, Math.round(value)),
  );
}

export function scopeWeight(scope: ScanModelScope): number {
  return {
    Exact: 1,
    RouteGroup: 0.75,
    RelayFilter: 0.65,
    SurfaceFilter: 0.55,
    Surface: 0.4,
    Global: 0.25,
    Neutral: 0,
  }[scope];
}

export function quality(model: ScanDensityModelRecord): number {
  return Math.max(
    0.1,
    1 - (model.incompleteRate ?? 0) * 0.5 - (model.limitHitRate ?? 0) * 0.1,
  );
}

export function confidence(
  weight: number,
  model: ScanDensityModelRecord,
): number {
  const value = (weight / (weight + 1)) * scopeWeight(model.scope) * quality(model);
  return Math.max(0, Math.min(1, value));
}
