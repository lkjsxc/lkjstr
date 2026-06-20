import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkCustomRequestDeletionGuard } from '../../scripts/repo-custom-request-deletions';

describe('repo custom-request deletion guard', () => {
  it('rejects product imports of retained custom-request modules', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-custom-'));
    const product = await write(
      root,
      'src/lib/workspace/reintroduced-custom-request.ts',
      "import { parseCustomRequest } from '../custom-request/parse';",
    );

    await expect(
      checkCustomRequestDeletionGuard(root, [product]),
    ).resolves.toEqual([
      {
        file: path.join(
          'src',
          'lib',
          'workspace',
          'reintroduced-custom-request.ts',
        ),
        message:
          'retained custom-request runtime must not be imported by product source',
      },
    ]);
  });

  it('allows retained custom-request internals until deletion proof', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-custom-'));
    const retained = await write(
      root,
      'src/lib/custom-request/read.ts',
      "import { customRequestMode } from './request-mode';",
    );

    await expect(
      checkCustomRequestDeletionGuard(root, [retained]),
    ).resolves.toEqual([]);
  });

  it('allows test-only imports while helpers stay retained', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-custom-'));
    const test = await write(
      root,
      'tests/unit/custom-request/parse.test.ts',
      "import { parseCustomRequest } from '../../../src/lib/custom-request/parse';",
    );

    await expect(
      checkCustomRequestDeletionGuard(root, [test]),
    ).resolves.toEqual([]);
  });
});

async function write(root: string, rel: string, text: string): Promise<string> {
  const file = path.join(root, rel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text);
  return file;
}
