import type { PostNodeKind, PostStatus, PostTreeNode } from './post-tree';

export function createPostNode(args: {
  readonly treeId: string;
  readonly parentId: string | null;
  readonly kind?: PostNodeKind;
  readonly status?: PostStatus;
  readonly title: string;
  readonly contentPreview?: string;
  readonly targetEventId?: string;
}): PostTreeNode {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    treeId: args.treeId,
    parentId: args.parentId,
    children: [],
    kind: args.kind ?? 'draft-note',
    status: args.status ?? 'local-draft',
    title: args.title,
    contentPreview: args.contentPreview ?? '',
    targetEventId: args.targetEventId,
    createdAt: now,
    updatedAt: now,
  };
}

export function addChild(parent: PostTreeNode, childId: string): PostTreeNode {
  if (parent.children.includes(childId)) return parent;
  return {
    ...parent,
    children: [...parent.children, childId],
    updatedAt: Date.now(),
  };
}
