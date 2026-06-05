import type { ScanBridgePlanInput } from './scan-model-bridge';
import type { ScanModelObservation } from './scan-model-observation';

export type ScanBridgeFailureReason =
  | 'unavailable'
  | 'timeout'
  | 'memory-fallback'
  | 'storage-unavailable'
  | 'invalid-input';

export function invalidPlanInputMessage(
  input: ScanBridgePlanInput,
): string | undefined {
  const context = invalidContextMessage(input.context);
  if (context) return context;
  if (!positive(input.effectiveLimit)) return 'effectiveLimit must be positive';
  if (!positive(input.requestedLimit)) return 'requestedLimit must be positive';
  if (!positive(input.pageSize)) return 'pageSize must be positive';
  if (!nonNegative(input.edgeSeconds))
    return 'edgeSeconds must be non-negative';
  if (!finite(input.nowMs)) return 'nowMs must be finite';
  if (
    input.previousSpanSeconds !== undefined &&
    !positive(input.previousSpanSeconds)
  )
    return 'previousSpanSeconds must be positive';
  return undefined;
}

export function invalidObservationInputMessage(
  observation: ScanModelObservation,
): string | undefined {
  const context = invalidContextMessage(observation);
  if (context) return context;
  if (!nonNegative(observation.sinceSeconds)) return 'sinceSeconds invalid';
  if (!nonNegative(observation.untilSeconds)) return 'untilSeconds invalid';
  if (observation.untilSeconds < observation.sinceSeconds)
    return 'untilSeconds precedes sinceSeconds';
  for (const [name, value] of countFields(observation)) {
    if (!nonNegative(value)) return `${name} must be non-negative`;
  }
  if (!positive(observation.requestedLimit)) return 'requestedLimit invalid';
  if (!positive(observation.effectiveLimit)) return 'effectiveLimit invalid';
  if (!finite(observation.startedAtMs) || !finite(observation.completedAtMs))
    return 'observation timestamps invalid';
  return undefined;
}

function invalidContextMessage(input: {
  readonly semanticFeedKey: string;
  readonly routeGroupKey: string;
  readonly semanticFilterKey: string;
  readonly direction: string;
}): string | undefined {
  if (!input.semanticFeedKey.trim()) return 'semanticFeedKey is required';
  if (!input.routeGroupKey.trim()) return 'routeGroupKey is required';
  if (!input.semanticFilterKey.trim()) return 'semanticFilterKey is required';
  if (input.direction !== 'older' && input.direction !== 'newer')
    return 'direction must be older or newer';
  return undefined;
}

function countFields(
  observation: ScanModelObservation,
): readonly (readonly [string, number])[] {
  return [
    ['eventCount', observation.eventCount],
    ['uniqueEventCount', observation.uniqueEventCount],
    ['finalVisibleCount', observation.finalVisibleCount],
  ];
}

function positive(value: number): boolean {
  return finite(value) && value > 0;
}

function nonNegative(value: number): boolean {
  return finite(value) && value >= 0;
}

function finite(value: number): boolean {
  return Number.isFinite(value);
}
