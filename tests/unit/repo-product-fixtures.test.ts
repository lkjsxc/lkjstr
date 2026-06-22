import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkProductFixtureImports } from '../../scripts/repo-product-fixtures';

describe('repo product fixture guard', () => {
  it('rejects product imports from tests and fixture segments', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-fixture-'));
    const testsImport = await write(
      root,
      'src/lib/feed/use-test.ts',
      "import { event } from '../../../tests/unit/fixtures/event';",
    );
    const fixtureImport = await write(
      root,
      'src/lib/feed/use-fixture.ts',
      "export { relay } from '$lib/feed/fixtures/relay';",
    );
    const allowed = await write(
      root,
      'src/lib/feed/use-real.ts',
      "import { relay } from '$lib/feed/real-relay';",
    );

    await expect(
      checkProductFixtureImports(root, [testsImport, fixtureImport, allowed]),
    ).resolves.toEqual([
      {
        file: path.join('src', 'lib', 'feed', 'use-test.ts'),
        message: 'product source must not import test fixtures or mock data',
      },
      {
        file: path.join('src', 'lib', 'feed', 'use-fixture.ts'),
        message: 'product source must not import test fixtures or mock data',
      },
    ]);
  });

  it('checks dynamic imports and leaves tests free to use fixtures', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-fixture-'));
    const dynamicImport = await write(
      root,
      'src/lib/feed/load.ts',
      "await import('$lib/feed/mocks/relay');",
    );
    const testImport = await write(
      root,
      'tests/unit/feed/load.test.ts',
      "import { relay } from './fixtures/relay';",
    );

    await expect(
      checkProductFixtureImports(root, [dynamicImport, testImport]),
    ).resolves.toEqual([
      {
        file: path.join('src', 'lib', 'feed', 'load.ts'),
        message: 'product source must not import test fixtures or mock data',
      },
    ]);
  });
});

async function write(root: string, rel: string, text: string): Promise<string> {
  const file = path.join(root, rel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text);
  return file;
}
