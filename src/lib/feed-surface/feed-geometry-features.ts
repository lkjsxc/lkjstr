import type { NostrEvent } from '$lib/protocol';
import { contentShapeHash } from './feed-geometry-hash';

export type FeedGeometryFeatures = {
  readonly rowKind: string;
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

export function featuresForFeedItem(
  item: unknown,
  widthPx?: number,
): FeedGeometryFeatures {
  const event = eventFromItem(item);
  const rowKind = rowKindFromItem(item, event);
  const content = event?.content ?? '';
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

export function estimateHeightFromFeatures(
  features: FeedGeometryFeatures,
): number {
  const base = baseHeight(features.rowKind);
  const text = estimatedTextHeight(features);
  const media = Math.min(6, features.mediaCount) * 150;
  const previews = Math.min(6, features.referencePreviewCount) * 96;
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

export function widthBucketIndex(widthPx?: number): number {
  const width = Math.max(0, Math.round(widthPx ?? 640));
  if (width <= 319) return 0;
  if (width <= 479) return 1;
  if (width <= 639) return 2;
  if (width <= 799) return 3;
  if (width <= 1023) return 4;
  return 5;
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

function eventValue(value: unknown): NostrEvent | undefined {
  if (!isRecord(value) || typeof value.content !== 'string') return undefined;
  if (typeof value.id !== 'string' || typeof value.kind !== 'number')
    return undefined;
  if (!Array.isArray(value.tags)) return undefined;
  return value as NostrEvent;
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

function baseHeight(rowKind: string): number {
  if (rowKind === 'thread-root' || rowKind === 'event') return 96;
  if (rowKind === 'notification') return 116;
  if (rowKind === 'leading') return 180;
  if (rowKind === 'footer') return 64;
  return 72;
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

function divCeil(value: number, divisor: number): number {
  return Math.floor((value + divisor - 1) / divisor);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
