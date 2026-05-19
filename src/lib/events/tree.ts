import { compareEventsDesc } from '../protocol';
import type { EventTreeNode, FeedEvent } from './types';

export function buildEventTree(items: readonly FeedEvent[]): EventTreeNode[] {
  const byId = new Map<string, FeedEvent>();
  for (const item of items) byId.set(item.event.id, item);
  const children = new Map<string, FeedEvent[]>();
  const roots: FeedEvent[] = [];
  for (const item of byId.values()) {
    const parentId = replyParentId(item.event.tags);
    if (parentId && byId.has(parentId)) {
      children.set(parentId, [...(children.get(parentId) ?? []), item]);
    } else {
      roots.push(item);
    }
  }
  return roots.sort(byEventDesc).map((item) => node(item, children, 0));
}

export function flattenEventTree(
  nodes: readonly EventTreeNode[],
): EventTreeNode[] {
  return nodes.flatMap((item) => [item, ...flattenEventTree(item.children)]);
}

export function replyParentId(
  tags: readonly (readonly string[])[],
): string | undefined {
  const reply = tags.find((tag) => tag[0] === 'e' && tag[3] === 'reply')?.[1];
  if (reply) return reply;
  const eventTags = tags.filter((tag) => tag[0] === 'e' && tag[1]);
  return eventTags.at(-1)?.[1];
}

function node(
  item: FeedEvent,
  children: Map<string, FeedEvent[]>,
  depth: number,
): EventTreeNode {
  return {
    ...item,
    depth,
    children: (children.get(item.event.id) ?? [])
      .sort(byEventDesc)
      .map((child) => node(child, children, depth + 1)),
  };
}

function byEventDesc(a: FeedEvent, b: FeedEvent): number {
  return compareEventsDesc(a.event, b.event);
}
