import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkUserTimelineDeletionGuard } from '../../scripts/repo-user-timeline-deletions';

describe('repo user-timeline deletion guard', () => {
  it('rejects product imports of the deleted route-plan helper', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-user-'));
    const product = await write(
      root,
      'src/lib/workspace/reintroduced-user-timeline-route.ts',
      "import { planUserTimelineRoute } from '../user-timeline/user-timeline-route-plan';",
    );
    const deleted = await write(
      root,
      'src/lib/user-timeline/user-timeline-route-plan.ts',
      'export const deletedHelper = true;',
    );

    await expect(
      checkUserTimelineDeletionGuard(root, [product, deleted]),
    ).resolves.toEqual([
      {
        file: path.join(
          'src',
          'lib',
          'workspace',
          'reintroduced-user-timeline-route.ts',
        ),
        message: 'deleted user-timeline route-plan helper must not be imported',
      },
    ]);
  });

  it('rejects product imports of retained user-timeline runtime modules', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-user-'));
    const product = await write(
      root,
      'src/lib/workspace/retained-user-timeline-route.ts',
      "import { createUserTimelineRuntime } from '../user-timeline/user-timeline-runtime';",
    );

    await expect(
      checkUserTimelineDeletionGuard(root, [product]),
    ).resolves.toEqual([
      {
        file: path.join(
          'src',
          'lib',
          'workspace',
          'retained-user-timeline-route.ts',
        ),
        message:
          'retained user-timeline runtime must not be imported by product source',
      },
    ]);
  });

  it('allows retained internals and test-only imports until deletion proof', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-user-'));
    const retained = await write(
      root,
      'src/lib/user-timeline/user-timeline-runtime.ts',
      "import { userTimelineInitialSnapshot } from './user-timeline-state';",
    );
    const test = await write(
      root,
      'tests/unit/user-timeline/runtime.test.ts',
      "import { runUserTimelineRuntime } from '../../../src/lib/user-timeline/user-timeline-runtime';",
    );

    await expect(
      checkUserTimelineDeletionGuard(root, [retained, test]),
    ).resolves.toEqual([]);
  });
});

async function write(root: string, rel: string, text: string): Promise<string> {
  const file = path.join(root, rel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text);
  return file;
}
