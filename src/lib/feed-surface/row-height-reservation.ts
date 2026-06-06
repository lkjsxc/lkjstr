import { createBoundedMap } from '$lib/fp/bounded-map';
import {
  estimateHeightFromFeatures,
  featuresForFeedItem,
} from './feed-geometry-features';
import {
  estimateHeightWithRust,
  warmFeedGeometryWasmBridge,
} from './feed-geometry-wasm';

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
let allowedShrinkCount = 0;
let anchorCompensationCount = 0;
warmFeedGeometryWasmBridge();

export type FeedRowWidthBucket =
  | '0-319'
  | '320-479'
  | '480-639'
  | '640-799'
  | '800-1023'
  | '1024+';

export function estimateFeedRowHeight(input: {
  readonly key: string;
  readonly item: unknown;
  readonly widthPx?: number;
}): number {
  const features = featuresForFeedItem(input.item, input.widthPx);
  const exact = measuredHeights.get(
    measurementKeyFromFeatures(input, features),
  );
  const estimated =
    exact ??
    estimateHeightWithRust({ key: input.key, features }) ??
    estimateHeightFromFeatures(features);
  const key = reservationKeyFromFeatures(input, features);
  const reserved = activeReservations.get(key);
  if (reserved && reserved.heightPx > estimated) {
    recordPreservedReservation(key, reserved, features.contentShapeHash);
    return reserved.heightPx;
  }
  activeReservations.set(key, {
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
  const features = featuresForFeedItem(input.item, input.widthPx);
  measuredHeights.set(measurementKeyFromFeatures(input, features), height);
  const key = reservationKeyFromFeatures(input, features);
  const previous = activeReservations.get(key)?.heightPx;
  if (previous !== undefined && height < previous) allowedShrinkCount += 1;
  activeReservations.set(key, {
    heightPx: height,
    contentShapeHash: features.contentShapeHash,
    source: 'measurement',
  });
}

export function clearFeedRowHeightsForKey(key: string): void {
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

export function widthBucketForPx(widthPx?: number): FeedRowWidthBucket {
  const width = Math.max(0, Math.round(widthPx ?? 640));
  if (width <= 319) return '0-319';
  if (width <= 479) return '320-479';
  if (width <= 639) return '480-639';
  if (width <= 799) return '640-799';
  if (width <= 1023) return '800-1023';
  return '1024+';
}

function measurementKeyFromFeatures(
  input: { readonly key: string; readonly widthPx?: number },
  features: ReturnType<typeof featuresForFeedItem>,
): string {
  return [
    input.key,
    features.rowKind,
    features.contentShapeHash,
    widthBucketForPx(input.widthPx),
    features.fontScaleBucket,
  ].join('\u0000');
}

function reservationKeyFromFeatures(
  input: { readonly key: string; readonly widthPx?: number },
  features: ReturnType<typeof featuresForFeedItem>,
): string {
  return [
    input.key,
    features.rowKind,
    widthBucketForPx(input.widthPx),
    features.fontScaleBucket,
  ].join('\u0000');
}

function recordPreservedReservation(
  key: string,
  reservation: ReservedRowHeight,
  contentShapeHash: string,
): void {
  if (reservation.contentShapeHash === contentShapeHash) return;
  preservedReservationKeys.set(key, true);
}
