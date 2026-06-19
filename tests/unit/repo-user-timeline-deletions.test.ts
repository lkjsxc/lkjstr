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

  it('allows retained user-timeline runtime imports', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-user-'));
    const product = await write(
      root,
      'src/lib/workspace/retained-user-timeline-route.ts',
      "import { createUserTimelineRuntime } from '../user-timeline/user-timeline-runtime';",
    );

    await expect(
      checkUserTimelineDeletionGuard(root, [product]),
    ).resolves.toEqual([]);
  });
});

async function write(root: string, rel: string, text: string): Promise<string> {
  const file = path.join(root, rel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text);
  return file;
}
