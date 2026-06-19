import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkTransitionalDeletionGuard } from '../../scripts/repo-transitional-deletions';

describe('repo transitional deletion guard', () => {
  it('rejects product imports of deleted transitional helpers', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-trans-'));
    const product = await write(
      root,
      'src/lib/workspace/reintroduced-transitional-helpers.ts',
      [
        "import { oldStore } from '../cache/event-store';",
        "import { oldHealth } from '../telemetry/runtime-health';",
        "import { oldProvider } from '../tweet/media-upload-providers';",
        "import { oldSplit } from './split-commands';",
      ].join('\n'),
    );
    const deleted = await Promise.all([
      write(root, 'src/lib/cache/event-store.ts', 'export const old = true;'),
      write(
        root,
        'src/lib/telemetry/runtime-health.ts',
        'export const old = true;',
      ),
      write(
        root,
        'src/lib/tweet/media-upload-providers.ts',
        'export const old = true;',
      ),
      write(
        root,
        'src/lib/workspace/split-commands.ts',
        'export const old = true;',
      ),
    ]);

    await expect(
      checkTransitionalDeletionGuard(root, [product, ...deleted]),
    ).resolves.toEqual([
      {
        file: path.join(
          'src',
          'lib',
          'workspace',
          'reintroduced-transitional-helpers.ts',
        ),
        message: 'deleted cache event-store helper must not be imported',
      },
      {
        file: path.join(
          'src',
          'lib',
          'workspace',
          'reintroduced-transitional-helpers.ts',
        ),
        message: 'deleted telemetry runtime-health shim must not be imported',
      },
      {
        file: path.join(
          'src',
          'lib',
          'workspace',
          'reintroduced-transitional-helpers.ts',
        ),
        message:
          'deleted tweet media-upload provider helper must not be imported',
      },
      {
        file: path.join(
          'src',
          'lib',
          'workspace',
          'reintroduced-transitional-helpers.ts',
        ),
        message: 'deleted workspace split-commands helper must not be imported',
      },
    ]);
  });

  it('allows retained replacement helpers', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-trans-'));
    const product = await write(
      root,
      'src/lib/workspace/retained-helpers.ts',
      "import { openUserTimelineTab } from './action-tabs';",
    );

    await expect(
      checkTransitionalDeletionGuard(root, [product]),
    ).resolves.toEqual([]);
  });
});

async function write(root: string, rel: string, text: string): Promise<string> {
  const file = path.join(root, rel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text);
  return file;
}
