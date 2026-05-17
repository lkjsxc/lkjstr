import { browserDb } from '../storage/browser-db';
import { createPostNode } from './post-node';
import type { PostTree, PostTreeNode } from './post-tree';

export async function getOrCreatePostTree(
  accountPubkey: string,
): Promise<PostTree> {
  const existing = await browserDb()
    .postTrees.where('accountPubkey')
    .equals(accountPubkey)
    .first();
  if (existing) return existing;
  const now = Date.now();
  const tree: PostTree = {
    id: crypto.randomUUID(),
    accountPubkey,
    rootNodeIds: [],
    collapsedNodeIds: [],
    createdAt: now,
    updatedAt: now,
  };
  await browserDb().postTrees.put(tree);
  return tree;
}

export async function createDraftNode(
  tree: PostTree,
  title: string,
  parentId: string | null = null,
): Promise<PostTreeNode> {
  const node = createPostNode({ treeId: tree.id, parentId, title });
  await browserDb().transaction(
    'rw',
    browserDb().postTrees,
    browserDb().postNodes,
    async () => {
      await browserDb().postNodes.put(node);
      if (!parentId) {
        await browserDb().postTrees.put({
          ...tree,
          rootNodeIds: [...tree.rootNodeIds, node.id],
          updatedAt: Date.now(),
        });
      }
    },
  );
  return node;
}

export async function treeNodes(treeId: string): Promise<PostTreeNode[]> {
  return browserDb().postNodes.where('treeId').equals(treeId).toArray();
}
