import type { ScanDensityModelRecord, ScanModelContext, ScanModelScope } from './scan-model-records';
import { scanModelKey, scanModelScopes, scopedContext } from './scan-model-keys';
import {
  minimumDensity,
  staleHalfLifeMs,
  targetDenominator,
  targetLimitCount,
  targetNumerator,
} from './scan-model-policy';

export type ScanModelObservation = ScanModelContext & {
  readonly sinceSeconds: number;
  readonly untilSeconds: number;
  readonly requestedLimit: number;
  readonly effectiveLimit: number;
  readonly eventCount: number;
  readonly uniqueEventCount: number;
  readonly finalVisibleCount: number;
  readonly eventLimitReached: boolean;
  readonly eose: boolean;
  readonly timeout: boolean;
  readonly closed: boolean;
  readonly auth: boolean;
  readonly socketError: boolean;
  readonly startedAtMs: number;
  readonly completedAtMs: number;
};

export function updateScanModelsFromObservation(input: {
  readonly observation: ScanModelObservation;
  readonly previousModels: readonly ScanDensityModelRecord[];
}): ScanDensityModelRecord[] {
  return scanModelScopes.map((scope) =>
    updateModel(
      input.previousModels.find((model) => model.scope === scope),
      input.observation,
      scope,
    ),
  );
}

function updateModel(
  previous: ScanDensityModelRecord | undefined,
  observation: ScanModelObservation,
  scope: ScanModelScope,
): ScanDensityModelRecord {
  const scoped = scopedContext(observation, scope);
  const density = observedDensity(observation);
  const weight = observationWeight(observation);
  const priorWeight = previous?.sampleWeight ?? 0;
  const sampleWeight = priorWeight + weight;
  const priorDensity = previous?.densityEventsPerSecond ?? density ?? minimumDensity;
  const nextDensity = blendDensity(priorDensity, priorWeight, density, weight);
  const complete = (previous?.completeWindowCount ?? 0) + count(completeObservation(observation));
  const dense = (previous?.denseWindowCount ?? 0) + count(observation.eventLimitReached);
  const incomplete = (previous?.incompleteWindowCount ?? 0) + count(!completeObservation(observation));
  return {
    ...scoped,
    modelKey: scanModelKey(observation, scope),
    scope,
    targetLimitFraction: `${targetNumerator}/${targetDenominator}`,
    densityEventsPerSecond: Math.max(nextDensity, minimumDensity),
    sampleWeight,
    updatedAtMs: observation.completedAtMs,
    decaysAfterMs: observation.completedAtMs + staleHalfLifeMs,
    completeWindowCount: complete,
    denseWindowCount: dense,
    sparseWindowCount: (previous?.sparseWindowCount ?? 0) + count(sparseObservation(observation)),
    incompleteWindowCount: incomplete,
    failureWindowCount: (previous?.failureWindowCount ?? 0) + count(failure(observation)),
    limitHitRate: rate(dense, complete + dense + incomplete),
    incompleteRate: rate(incomplete, complete + dense + incomplete),
    lastGoodSpanSeconds: completeObservation(observation)
      ? spanSeconds(observation)
      : previous?.lastGoodSpanSeconds,
    lastProposedSpanSeconds: spanSeconds(observation),
  };
}

function blendDensity(
  priorDensity: number,
  priorWeight: number,
  density: number | undefined,
  weight: number,
): number {
  if (density === undefined || priorWeight + weight <= 0) return priorDensity;
  return ((priorDensity * priorWeight) + density * weight) / (priorWeight + weight);
}

export function observedDensity(
  observation: ScanModelObservation,
): number | undefined {
  const span = spanSeconds(observation);
  if (observation.eventLimitReached) return observation.effectiveLimit / span;
  if (completeObservation(observation)) return observation.finalVisibleCount / span;
  const weak = Math.max(
    observation.finalVisibleCount,
    observation.uniqueEventCount,
    observation.eventCount,
  );
  return weak > 0 ? weak / span : undefined;
}

export function spanSeconds(observation: ScanModelObservation): number {
  return Math.max(1, observation.untilSeconds - observation.sinceSeconds);
}

function observationWeight(observation: ScanModelObservation): number {
  if (observation.eventLimitReached || completeObservation(observation)) return 1;
  return observedDensity(observation) === undefined ? 0 : 0.25;
}

function completeObservation(observation: ScanModelObservation): boolean {
  return observation.eose && !failure(observation);
}

function sparseObservation(observation: ScanModelObservation): boolean {
  return (
    completeObservation(observation) &&
    observation.finalVisibleCount < targetLimitCount(observation.effectiveLimit)
  );
}

function failure(observation: ScanModelObservation): boolean {
  return observation.timeout || observation.closed || observation.auth || observation.socketError;
}

function rate(countValue: number, total: number): number {
  return total <= 0 ? 0 : countValue / total;
}

function count(value: boolean): number {
  return value ? 1 : 0;
}
