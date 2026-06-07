import type { FeedGeometryFeatures } from './feed-geometry-features';

export function estimateHeightFromFeatures(
  features: FeedGeometryFeatures,
): number {
  const base = baseHeight(features.rowKind);
  const text = estimatedTextHeight(features);
  const media = Math.min(6, features.mediaCount) * 150;
  const previews = referencePreviewHeight(features);
  const profile = features.hasProfileSummary ? 88 : 0;
  const chrome = features.hasNotificationChrome ? 36 : 0;
  const action = features.hasActionBar ? 40 : 0;
  const warning = features.hasContentWarning ? 28 : 0;
  return clamp(
    base + text + media + previews + profile + chrome + action + warning,
    48,
    8_000,
  );
}

function estimatedTextHeight(features: FeedGeometryFeatures): number {
  const charsPerLine = [30, 42, 56, 72, 88, 108][features.widthBucket] ?? 108;
  const wrapLines = divCeil(features.unicodeScalarCount, charsPerLine);
  const tokenExtra = divCeil(
    features.longestUnbrokenTokenLength,
    charsPerLine * 2,
  );
  const lines =
    wrapLines +
    features.lineBreakCount +
    tokenExtra +
    Math.min(12, features.urlCount) * 2 +
    Math.floor(Math.min(24, features.customEmojiCount) / 4);
  return lines * (20 + Math.min(4, features.fontScaleBucket) * 2);
}

function referencePreviewHeight(features: FeedGeometryFeatures): number {
  const count = features.referencePreviewCount;
  if (count <= 0) return 0;
  if (features.materializationTier === 'enriched')
    return Math.min(6, count) * 96;
  if (features.materializationTier === 'structural')
    return Math.min(3, count) * 36;
  return 0;
}

function baseHeight(rowKind: string): number {
  if (rowKind === 'thread-root' || rowKind === 'event') return 96;
  if (rowKind === 'notification') return 116;
  if (rowKind === 'leading') return 180;
  if (rowKind === 'user-row') return 72;
  if (rowKind === 'footer') return 64;
  return 72;
}

function divCeil(value: number, divisor: number): number {
  return Math.floor((value + divisor - 1) / divisor);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}
