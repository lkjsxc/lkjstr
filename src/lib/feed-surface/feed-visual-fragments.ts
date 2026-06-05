import type { FlatEventTreeItem } from '$lib/events/tree';
import {
  estimateHeightFromFeatures,
  featuresForFeedItem,
} from './feed-geometry-features';
import {
  splitText,
  textSegmentMaxChars,
  textSegmentTargetChars,
} from './feed-visual-fragment-text';

export { textSegmentMaxChars, textSegmentTargetChars };
export const oversizeEstimatedHeight = 1_400;
export const mediaItemsPerSegment = 2;
export const referencesPerSegment = 1;

export type FeedVisualFragment =
  | { readonly kind: 'event-full'; readonly rowKey: string }
  | { readonly kind: 'event-header'; readonly rowKey: string }
  | {
      readonly kind: 'event-text-segment';
      readonly rowKey: string;
      readonly segmentIndex: number;
      readonly text: string;
      readonly startsAt: number;
      readonly endsAt: number;
    }
  | {
      readonly kind: 'event-media-segment';
      readonly rowKey: string;
      readonly index: number;
    }
  | {
      readonly kind: 'event-reference-segment';
      readonly rowKey: string;
      readonly index: number;
    }
  | { readonly kind: 'event-actions'; readonly rowKey: string };

export function planEventVisualFragments(
  node: FlatEventTreeItem,
): readonly FeedVisualFragment[] {
  if (!('event' in node)) return [];
  const features = featuresForFeedItem({ kind: 'event', node });
  const estimate = estimateHeightFromFeatures(features);
  const mediaCount = features.mediaCount;
  const referenceCount = features.referencePreviewCount;
  if (
    estimate < oversizeEstimatedHeight &&
    mediaCount <= mediaItemsPerSegment &&
    referenceCount <= referencesPerSegment
  )
    return [
      {
        kind: 'event-full',
        rowKey: fragmentKey(node, features.contentShapeHash, 'event-full', 0),
      },
    ];
  return [
    {
      kind: 'event-header',
      rowKey: fragmentKey(node, features.contentShapeHash, 'event-header', 0),
    },
    ...textFragments(node, features.contentShapeHash),
    ...indexedFragments(
      node,
      features.contentShapeHash,
      'event-media-segment',
      mediaCount,
      mediaItemsPerSegment,
    ),
    ...indexedFragments(
      node,
      features.contentShapeHash,
      'event-reference-segment',
      referenceCount,
      referencesPerSegment,
    ),
    {
      kind: 'event-actions',
      rowKey: fragmentKey(node, features.contentShapeHash, 'event-actions', 0),
    },
  ];
}

export function fragmentEventContent(
  node: FlatEventTreeItem,
  fragment: FeedVisualFragment,
) {
  const event = node.event;
  if (fragment.kind === 'event-text-segment')
    return { ...event, content: fragment.text, tags: emojiTags(event.tags) };
  if (fragment.kind === 'event-media-segment')
    return {
      ...event,
      content: '',
      tags: tagsForChunk(
        event.tags,
        'imeta',
        fragment.index,
        mediaItemsPerSegment,
      ),
    };
  if (fragment.kind === 'event-reference-segment')
    return {
      ...event,
      content: '',
      tags: referenceTagsForChunk(event.tags, fragment.index),
    };
  return { ...event, content: '', tags: [] };
}

function textFragments(
  node: FlatEventTreeItem,
  shapeHash: string,
): FeedVisualFragment[] {
  return splitText(node.event.content).map((segment, index) => ({
    kind: 'event-text-segment' as const,
    rowKey: fragmentKey(node, shapeHash, 'event-text-segment', index),
    segmentIndex: index,
    text: segment.text,
    startsAt: segment.startsAt,
    endsAt: segment.endsAt,
  }));
}

function indexedFragments(
  node: FlatEventTreeItem,
  shapeHash: string,
  kind: 'event-media-segment' | 'event-reference-segment',
  count: number,
  perSegment: number,
): FeedVisualFragment[] {
  return Array.from(
    { length: Math.ceil(count / Math.max(1, perSegment)) },
    (_, index) => ({
      kind,
      rowKey: fragmentKey(node, shapeHash, kind, index),
      index,
    }),
  );
}

function fragmentKey(
  node: FlatEventTreeItem,
  shapeHash: string,
  kind: string,
  index: number,
): string {
  return `event:${node.event.id}:shape:${shapeHash}:kind:${kind}:index:${index}`;
}

function emojiTags(tags: readonly (readonly string[])[]) {
  return tags.filter((tag) => tag[0] === 'emoji');
}

function referenceTagsForChunk(
  tags: readonly (readonly string[])[],
  index: number,
) {
  const refs = tags.filter(
    (tag) => tag[0] === 'e' || tag[0] === 'a' || tag[0] === 'q',
  );
  return refs.slice(
    index * referencesPerSegment,
    (index + 1) * referencesPerSegment,
  );
}

function tagsForChunk(
  tags: readonly (readonly string[])[],
  tagName: string,
  index: number,
  perSegment: number,
) {
  const selected = tags.filter((tag) => tag[0] === tagName);
  return selected.slice(index * perSegment, (index + 1) * perSegment);
}
