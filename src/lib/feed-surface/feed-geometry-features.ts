import type { NostrEvent } from '$lib/protocol';
import { actionSummary } from '$lib/events/action-summary';
import {
  contentShapeHash,
  type MaterializationTier,
} from './feed-geometry-hash';

export type { FeedGeometryFeatures } from './feed-geometry-features-types';
import type { FeedGeometryFeatures } from './feed-geometry-features-types';

export function featuresForFeedItem(
  item: unknown,
  widthPx?: number,
  materializationTier: MaterializationTier = 'structural',
): FeedGeometryFeatures {
  const event = eventFromItem(item);
  const rowKind = rowKindFromItem(item, event);
  const content = geometryVisibleContent(event);
  const tags = event?.tags ?? [];
  const shape = {
    contentLength: content.length,
    unicodeScalarCount: [...content].length,
    lineBreakCount: countMatches(content, '\n'),
    longestUnbrokenTokenLength: longestToken(content),
    urlCount: countUrls(content),
    mediaCount: countTags(tags, 'imeta'),
    referencePreviewCount: countReferenceTags(tags),
    customEmojiCount: countTags(tags, 'emoji'),
    hasContentWarning: hasTag(tags, 'content-warning'),
    fragmentCount: 1,
    materializationTier,
  };
  return {
    rowKind,
    eventKind: event?.kind,
    ...shape,
    hasProfileSummary: rowKind === 'leading',
    hasNotificationChrome: rowKind === 'notification',
    hasActionBar: rowKind === 'event' || rowKind === 'thread-root',
    widthBucket: widthBucketIndex(widthPx),
    fontScaleBucket: 1,
    contentShapeHash: contentShapeHash(shape),
  };
}

export function widthBucketIndex(widthPx?: number): number {
  const width = Math.max(0, Math.round(widthPx ?? 640));
  if (width <= 319) return 0;
  if (width <= 479) return 1;
  if (width <= 639) return 2;
  if (width <= 799) return 3;
  if (width <= 1023) return 4;
  return 5;
}

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

function eventFromItem(item: unknown): NostrEvent | undefined {
  if (!isRecord(item)) return undefined;
  if (item.kind === 'event' && isRecord(item.node))
    return eventValue(item.node.event);
  if ('event' in item) return eventValue(item.event);
  return undefined;
}

function rowKindFromItem(item: unknown, event: NostrEvent | undefined): string {
  if (!isRecord(item)) return event ? 'event' : 'unavailable';
  if (item.kind === 'followee' || item.kind === 'user-row') return 'user-row';
  if (
    item.kind === 'header' ||
    item.kind === 'guidance' ||
    item.kind === 'retry'
  )
    return 'leading';
  if (item.kind === 'status') return 'footer';
  if (item.kind === 'leading') return 'leading';
  if (item.kind === 'empty') return 'unavailable';
  if (
    item.kind === 'loadingOlder' ||
    item.kind === 'terminal' ||
    item.kind === 'footer'
  )
    return 'footer';
  if (item.kind === 'record') return 'notification';
  if (item.kind === 'event' && isRecord(item.node) && item.node.depth === 0)
    return 'thread-root';
  return event ? 'event' : 'unavailable';
}

function geometryVisibleContent(event: NostrEvent | undefined): string {
  if (!event) return '';
  const summary = actionSummary(event);
  if (!summary) return event.content;
  return [summary.verb, summary.detail].filter(Boolean).join(' ');
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

function eventValue(value: unknown): NostrEvent | undefined {
  if (!isRecord(value) || typeof value.content !== 'string') return undefined;
  if (typeof value.id !== 'string' || typeof value.kind !== 'number')
    return undefined;
  if (!Array.isArray(value.tags)) return undefined;
  return value as NostrEvent;
}

function countReferenceTags(tags: readonly (readonly string[])[]): number {
  return tags.filter(
    (tag) => tag[0] === 'e' || tag[0] === 'a' || tag[0] === 'q',
  ).length;
}

function countTags(tags: readonly (readonly string[])[], name: string): number {
  return tags.filter((tag) => tag[0] === name).length;
}

function hasTag(tags: readonly (readonly string[])[], name: string): boolean {
  return tags.some((tag) => tag[0] === name);
}

function countUrls(content: string): number {
  return content.split(/\s+/u).filter((token) => /^https?:\/\//iu.test(token))
    .length;
}

function longestToken(content: string): number {
  return Math.max(
    0,
    ...content.split(/\s+/u).map((token) => [...token].length),
  );
}

function countMatches(content: string, token: string): number {
  return content.split(token).length - 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function divCeil(value: number, divisor: number): number {
  return Math.floor((value + divisor - 1) / divisor);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}
