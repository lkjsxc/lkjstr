import type { featuresForFeedItem } from './feed-geometry-features';

export type FeedRowWidthBucket =
  | '0-319'
  | '320-479'
  | '480-639'
  | '640-799'
  | '800-1023'
  | '1024+';

export function widthBucketForPx(widthPx?: number): FeedRowWidthBucket {
  const width = Math.max(0, Math.round(widthPx ?? 640));
  if (width <= 319) return '0-319';
  if (width <= 479) return '320-479';
  if (width <= 639) return '480-639';
  if (width <= 799) return '640-799';
  if (width <= 1023) return '800-1023';
  return '1024+';
}

export function measurementKeyFromFeatures(
  input: { readonly key: string; readonly widthPx?: number },
  features: ReturnType<typeof featuresForFeedItem>,
): string {
  return [
    input.key,
    features.rowKind,
    features.contentShapeHash,
    features.materializationTier,
    widthBucketForPx(input.widthPx),
    features.fontScaleBucket,
  ].join('\u0000');
}

export function reservationKeyFromFeatures(
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
