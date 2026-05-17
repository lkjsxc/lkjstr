import { describe, expect, it } from 'vitest';
import {
  addChild,
  createPostNode,
} from '../../../src/lib/post-manager/post-node';

describe('post tree nodes', () => {
  it('creates durable draft tree nodes and links children', () => {
    const parent = createPostNode({
      treeId: 'tree',
      parentId: null,
      title: 'Root draft',
    });
    const child = createPostNode({
      treeId: 'tree',
      parentId: parent.id,
      title: 'Reply draft',
      kind: 'draft-reply',
    });
    expect(addChild(parent, child.id).children).toEqual([child.id]);
    expect(child).toMatchObject({ status: 'local-draft', kind: 'draft-reply' });
  });
});
