import type { MaterializationTier } from './feed-geometry-hash';

export type FeedGeometryFeatures = {
  readonly rowKind: string;
  readonly materializationTier: MaterializationTier;
  readonly eventKind?: number;
  readonly contentLength: number;
  readonly unicodeScalarCount: number;
  readonly lineBreakCount: number;
  readonly longestUnbrokenTokenLength: number;
  readonly urlCount: number;
  readonly mediaCount: number;
  readonly referencePreviewCount: number;
  readonly customEmojiCount: number;
  readonly hasContentWarning: boolean;
  readonly hasProfileSummary: boolean;
  readonly hasNotificationChrome: boolean;
  readonly hasActionBar: boolean;
  readonly widthBucket: number;
  readonly fontScaleBucket: number;
  readonly contentShapeHash: string;
};
