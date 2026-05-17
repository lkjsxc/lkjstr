export type PostNodeKind =
  | 'draft-note'
  | 'draft-reply'
  | 'draft-thread'
  | 'published-note'
  | 'published-reply'
  | 'reaction'
  | 'repost'
  | 'quote'
  | 'delete-request'
  | 'failed-publish'
  | 'template'
  | 'attachment';

export type PostStatus =
  | 'local-draft'
  | 'ready-to-sign'
  | 'signed'
  | 'publishing'
  | 'published'
  | 'published-partial'
  | 'failed'
  | 'archived-local';

export type PostTree = {
  readonly id: string;
  readonly accountPubkey: string;
  readonly rootNodeIds: readonly string[];
  readonly collapsedNodeIds: readonly string[];
  readonly createdAt: number;
  readonly updatedAt: number;
};

export type PostTreeNode = {
  readonly id: string;
  readonly treeId: string;
  readonly parentId: string | null;
  readonly children: readonly string[];
  readonly kind: PostNodeKind;
  readonly status: PostStatus;
  readonly title: string;
  readonly contentPreview: string;
  readonly draftId?: string;
  readonly eventId?: string;
  readonly targetEventId?: string;
  readonly relayResultSetId?: string;
  readonly createdAt: number;
  readonly updatedAt: number;
};
