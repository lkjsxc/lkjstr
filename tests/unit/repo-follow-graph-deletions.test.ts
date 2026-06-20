import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkFollowGraphDeletionGuard } from '../../scripts/repo-follow-graph-deletions';

describe('repo follow-graph deletion guard', () => {
  it('rejects product imports of retained follow-graph runtime modules', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-follow-'));
    const product = await write(
      root,
      'src/lib/workspace/reintroduced-follow-graph.ts',
      "import { createTargetFollowListRuntime } from '../follow-graph/target-follow-list-runtime';",
    );

    await expect(
      checkFollowGraphDeletionGuard(root, [product]),
    ).resolves.toEqual([
      {
        file: path.join(
          'src',
          'lib',
          'workspace',
          'reintroduced-follow-graph.ts',
        ),
        message:
          'retained follow-graph runtime must not be imported by product source',
      },
    ]);
  });

  it('allows retained follow-graph internals until deletion proof', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-follow-'));
    const retained = await write(
      root,
      'src/lib/follow-graph/target-follow-list-runtime.ts',
      "import { createTargetFollowListState } from './target-follow-list-state';",
    );

    await expect(
      checkFollowGraphDeletionGuard(root, [retained]),
    ).resolves.toEqual([]);
  });

  it('allows retained user-timeline helpers to compose follow-graph', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-follow-'));
    const retained = await write(
      root,
      'src/lib/user-timeline/user-timeline-runtime.ts',
      "import { createTargetFollowListRuntime } from '$lib/follow-graph/target-follow-list-runtime';",
    );

    await expect(
      checkFollowGraphDeletionGuard(root, [retained]),
    ).resolves.toEqual([]);
  });

  it('allows test-only imports while helpers stay retained', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-follow-'));
    const test = await write(
      root,
      'tests/unit/follow-graph/runtime.test.ts',
      "import { createTargetFollowListRuntime } from '../../../src/lib/follow-graph/target-follow-list-runtime';",
    );

    await expect(checkFollowGraphDeletionGuard(root, [test])).resolves.toEqual(
      [],
    );
  });
});

async function write(root: string, rel: string, text: string): Promise<string> {
  const file = path.join(root, rel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text);
  return file;
}
