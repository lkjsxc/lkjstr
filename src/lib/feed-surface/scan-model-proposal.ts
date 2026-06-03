import type {
  ScanDensityModelRecord,
  ScanModelContext,
  ScanModelScope,
} from './scan-model-records';
import {
  clampSpan,
  confidence,
  maxChangeFactor,
  minimumDensity,
  neutralPriorWeight,
  neutralSpanSeconds,
  quality,
  scopeWeight,
  staleHalfLifeMs,
  targetLimitCount,
} from './scan-model-policy';

export type ScanSpanProposal = {
  readonly spanSeconds: number;
  readonly targetCount: number;
  readonly effectiveLimit: number;
  readonly estimatedDensityEventsPerSecond: number;
  readonly sourceScope: ScanModelScope;
  readonly sourceModelKey: string;
  readonly confidence: number;
  readonly capReason?: 'increase-limited' | 'decrease-limited';
};

export function proposeScanSpanFromModels(input: {
  readonly context: ScanModelContext;
  readonly models: readonly ScanDensityModelRecord[];
  readonly effectiveLimit: number;
  readonly previousSpanSeconds?: number;
  readonly nowMs: number;
}): ScanSpanProposal | undefined {
  const contributions = input.models
    .filter((model) => model.scope !== 'Neutral')
    .map((model) => ({ model, weight: modelWeight(model, input.nowMs) }))
    .filter((item) => item.weight > 0);
  if (contributions.length === 0) return undefined;
  const targetCount = targetLimitCount(input.effectiveLimit);
  const totalWeight = contributions.reduce((sum, item) => sum + item.weight, 0);
  const source = contributions.reduce((best, item) =>
    item.weight > best.weight ? item : best,
  );
  const density = blendedDensity(contributions, targetCount, totalWeight);
  const bounded = clampSpan(targetCount / Math.max(density, minimumDensity));
  const previous = previousUsableSpan(input.previousSpanSeconds, source.model);
  const capped = changeCappedSpan(bounded, previous);
  return {
    spanSeconds: capped.span,
    targetCount,
    effectiveLimit: Math.max(1, Math.floor(input.effectiveLimit)),
    estimatedDensityEventsPerSecond: density,
    sourceScope: source.model.scope,
    sourceModelKey: source.model.modelKey,
    confidence: confidence(totalWeight, source.model),
    capReason: capped.reason,
  };
}

function blendedDensity(
  contributions: readonly {
    readonly model: ScanDensityModelRecord;
    readonly weight: number;
  }[],
  targetCount: number,
  totalWeight: number,
): number {
  const neutralDensity = targetCount / neutralSpanSeconds;
  const weighted = contributions.reduce(
    (sum, item) => sum + item.model.densityEventsPerSecond * item.weight,
    neutralDensity * neutralPriorWeight,
  );
  return weighted / (totalWeight + neutralPriorWeight);
}

function modelWeight(model: ScanDensityModelRecord, nowMs: number): number {
  const age = Math.max(0, nowMs - model.updatedAtMs);
  const decay = 0.5 ** (age / staleHalfLifeMs);
  return model.sampleWeight * decay * scopeWeight(model.scope) * quality(model);
}

function previousUsableSpan(
  previousSpan: number | undefined,
  model: ScanDensityModelRecord,
): number {
  return Math.max(
    1,
    previousSpan ??
      model.lastGoodSpanSeconds ??
      model.lastProposedSpanSeconds ??
      neutralSpanSeconds,
  );
}

function changeCappedSpan(span: number, previous: number) {
  const lower = previous / maxChangeFactor;
  const upper = previous * maxChangeFactor;
  if (span > upper)
    return { span: clampSpan(upper), reason: 'increase-limited' as const };
  if (span < lower)
    return { span: clampSpan(lower), reason: 'decrease-limited' as const };
  return { span: clampSpan(span) };
}
