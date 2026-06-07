import type { FeedGeometryFeatures } from './feed-geometry-features';

export type FeedGeometryBridgeStatus =
  | { readonly status: 'unrequested' | 'loading' | 'available' }
  | { readonly status: 'unavailable'; readonly message: string };

export type FeedGeometryModel = {
  readonly bucket_key: string;
  readonly average_height_px: number;
  readonly sample_count: number;
  readonly updated_at_ms: number;
};

export type FeedGeometryWasmExports = {
  readonly estimate_feed_row_height_from_js?: (input: unknown) => unknown;
  readonly record_feed_row_measurement_from_js?: (input: unknown) => unknown;
  readonly next_feed_row_reservation_from_js?: (input: unknown) => unknown;
  readonly plan_feed_visual_rows_from_js?: (input: unknown) => unknown;
  readonly capture_feed_anchor_from_js?: (input: unknown) => unknown;
  readonly reconcile_feed_anchor_from_js?: (input: unknown) => unknown;
};

let exportsCache: FeedGeometryWasmExports | undefined;
let bridgeStatus: FeedGeometryBridgeStatus = { status: 'unrequested' };
let loading: Promise<void> | undefined;

export function warmFeedGeometryWasmBridge(): void {
  if (loading || bridgeStatus.status === 'available') return;
  bridgeStatus = { status: 'loading' };
  loading = import('virtual:lkjstr-web-wasm')
    .then(async (module) => {
      exportsCache =
        (await module.loadLkjstrWebWasm()) as FeedGeometryWasmExports;
      bridgeStatus = { status: 'available' };
    })
    .catch((error: unknown) => {
      bridgeStatus = {
        status: 'unavailable',
        message: error instanceof Error ? error.message : String(error),
      };
    })
    .finally(() => {
      loading = undefined;
    });
}

export function feedGeometryWasmBridgeStatus(): FeedGeometryBridgeStatus {
  return bridgeStatus;
}

export function estimateHeightWithRust(input: {
  readonly key: string;
  readonly features: FeedGeometryFeatures;
  readonly models?: readonly FeedGeometryModel[];
}): number | undefined {
  const fn = exportsCache?.estimate_feed_row_height_from_js;
  if (!fn) return undefined;
  const output = fn({
    key: input.key,
    features: rustFeatures(input.features),
    models: input.models ?? [],
  });
  return heightFromOutput(output);
}

export function nextReservationWithRust(input: unknown): unknown {
  return exportsCache?.next_feed_row_reservation_from_js?.(input);
}

export function createFeedGeometryWasmBridge(exports: FeedGeometryWasmExports) {
  return {
    estimateHeight(input: {
      readonly key: string;
      readonly features: FeedGeometryFeatures;
      readonly models?: readonly FeedGeometryModel[];
    }) {
      const output = exports.estimate_feed_row_height_from_js?.({
        key: input.key,
        features: rustFeatures(input.features),
        models: input.models ?? [],
      });
      return heightFromOutput(output);
    },
    nextReservation(input: unknown) {
      return exports.next_feed_row_reservation_from_js?.(input);
    },
  };
}

function rustFeatures(features: FeedGeometryFeatures) {
  return {
    row_kind: features.rowKind,
    event_kind: features.eventKind,
    content_length: features.contentLength,
    unicode_scalar_count: features.unicodeScalarCount,
    line_break_count: features.lineBreakCount,
    longest_unbroken_token_length: features.longestUnbrokenTokenLength,
    url_count: features.urlCount,
    media_count: features.mediaCount,
    reference_preview_count: features.referencePreviewCount,
    custom_emoji_count: features.customEmojiCount,
    has_content_warning: features.hasContentWarning,
    has_profile_summary: features.hasProfileSummary,
    has_notification_chrome: features.hasNotificationChrome,
    has_action_bar: features.hasActionBar,
    width_bucket: features.widthBucket,
    font_scale_bucket: features.fontScaleBucket,
    content_shape_hash: features.contentShapeHash,
    materialization_tier: features.materializationTier,
  };
}

function heightFromOutput(output: unknown): number | undefined {
  if (typeof output !== 'object' || output === null) return undefined;
  const height = (output as { readonly estimated_height_px?: unknown })
    .estimated_height_px;
  return typeof height === 'number' && Number.isFinite(height) && height > 0
    ? Math.round(height)
    : undefined;
}
