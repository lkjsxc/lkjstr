import { createBoundedMap } from '$lib/fp/bounded-map';
import {
  estimateHeightFromFeatures,
  featuresForFeedItem,
} from './feed-geometry-features';
import type { MaterializationTier } from './feed-geometry-hash';
import {
  estimateHeightWithRust,
  warmFeedGeometryWasmBridge,
} from './feed-geometry-wasm';
import {
  measurementKeyFromFeatures,
  reservationKeyFromFeatures,
  widthBucketForPx,
} from './row-height-reservation-keys';

export { widthBucketForPx };
export type { FeedRowWidthBucket } from './row-height-reservation-keys';

type ReservedRowHeight = {
  readonly heightPx: number;
  readonly contentShapeHash: string;
  readonly source: 'estimate' | 'measurement';
};

const measuredHeights = createBoundedMap<string, number>({ maxSize: 2_000 });
const activeReservations = createBoundedMap<string, ReservedRowHeight>({
  maxSize: 2_000,
});
const preservedReservationKeys = createBoundedMap<string, true>({
  maxSize: 500,
});
const materializedRowKeys = createBoundedMap<string, true>({ maxSize: 500 });
let allowedShrinkCount = 0;
let anchorCompensationCount = 0;
warmFeedGeometryWasmBridge();

export function markFeedRowMaterialized(key: string): void {
  materializedRowKeys.set(key, true);
}

export function markFeedRowDematerialized(key: string): void {
  materializedRowKeys.delete(key);
}

export function estimateFeedRowHeight(input: {
  readonly key: string;
  readonly item: unknown;
  readonly widthPx?: number;
}): number {
  const tier = materializationTierForKey(input.key);
  const features = featuresForFeedItem(input.item, input.widthPx, tier);
  const structuralEstimate = structuralHeightEstimate(input, tier);
  const exact = measuredHeights.get(
    measurementKeyFromFeatures(input, features),
  );
  const estimated =
    exact ??
    estimateHeightWithRust({ key: input.key, features }) ??
    estimateHeightFromFeatures(features);
  const reservationKey = reservationKeyFromFeatures(input, features);
  const reserved = activeReservations.get(reservationKey);
  if (reserved && reserved.heightPx > estimated) {
    if (
      tier === 'enriched' &&
      reserved.contentShapeHash === features.contentShapeHash
    ) {
      recordPreservedReservation(
        reservationKey,
        reserved,
        features.contentShapeHash,
      );
      return reserved.heightPx;
    }
    if (tier !== 'enriched' && reserved.heightPx > structuralEstimate)
      return Math.max(estimated, structuralEstimate);
  }
  activeReservations.set(reservationKey, {
    heightPx: estimated,
    contentShapeHash: features.contentShapeHash,
    source: exact ? 'measurement' : 'estimate',
  });
  return estimated;
}

export function recordFeedRowHeight(input: {
  readonly key: string;
  readonly item?: unknown;
  readonly widthPx?: number;
  readonly heightPx: number;
}): void {
  const height = Math.round(input.heightPx);
  if (height <= 0) return;
  const tier = materializationTierForKey(input.key);
  const features = featuresForFeedItem(input.item, input.widthPx, tier);
  measuredHeights.set(measurementKeyFromFeatures(input, features), height);
  const reservationKey = reservationKeyFromFeatures(input, features);
  const previous = activeReservations.get(reservationKey)?.heightPx;
  if (previous !== undefined && height < previous) allowedShrinkCount += 1;
  activeReservations.set(reservationKey, {
    heightPx: height,
    contentShapeHash: features.contentShapeHash,
    source: 'measurement',
  });
}

export function clearFeedRowHeightsForKey(key: string): void {
  materializedRowKeys.delete(key);
  for (const [storedKey] of measuredHeights.entries()) {
    if (storedKey.startsWith(`${key}\u0000`)) measuredHeights.delete(storedKey);
  }
  for (const [storedKey] of activeReservations.entries()) {
    if (storedKey.startsWith(`${key}\u0000`))
      activeReservations.delete(storedKey);
  }
  for (const [storedKey] of preservedReservationKeys.entries()) {
    if (storedKey.startsWith(`${key}\u0000`))
      preservedReservationKeys.delete(storedKey);
  }
}

function materializationTierForKey(key: string): MaterializationTier {
  return materializedRowKeys.get(key) ? 'enriched' : 'structural';
}

function structuralHeightEstimate(
  input: { readonly item: unknown; readonly widthPx?: number },
  tier: MaterializationTier,
): number {
  if (tier === 'enriched') return 0;
  const structural = featuresForFeedItem(
    input.item,
    input.widthPx,
    'structural',
  );
  return (
    estimateHeightWithRust({ key: 'structural-cap', features: structural }) ??
    estimateHeightFromFeatures(structural)
  );
}

export function feedRowHeightReservationCount(): number {
  return measuredHeights.size();
}

export function recordFeedRowAnchorCompensation(): void {
  anchorCompensationCount += 1;
}

export function feedRowHeightDiagnostics(): {
  readonly measuredRows: number;
  readonly activeReservations: number;
  readonly unloadPreservedRows: number;
  readonly allowedShrinkRows: number;
  readonly anchorCompensations: number;
} {
  return {
    measuredRows: measuredHeights.size(),
    activeReservations: activeReservations.size(),
    unloadPreservedRows: preservedReservationKeys.size(),
    allowedShrinkRows: allowedShrinkCount,
    anchorCompensations: anchorCompensationCount,
  };
}

function recordPreservedReservation(
  key: string,
  reservation: ReservedRowHeight,
  contentShapeHash: string,
): void {
  if (reservation.contentShapeHash !== contentShapeHash) return;
  preservedReservationKeys.set(key, true);
}
