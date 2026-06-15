import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkDeletedPaths } from '../../scripts/repo-deleted-paths';

describe('repo deleted path guard', () => {
  it('rejects removed transitional wrappers without blocking retained helpers', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-deleted-'));
    await write(
      root,
      'src/lib/tabs/followees/FolloweesTab.svelte',
      '<section>old wrapper</section>',
    );
    await write(
      root,
      'src/lib/components/events/EventMoreMenu.svelte',
      '<button>old menu</button>',
    );
    await write(
      root,
      'src/lib/tabs/followees/followees-scroll-rows.ts',
      'export const retained = true;',
    );

    await expect(checkDeletedPaths(root)).resolves.toEqual([
      {
        file: path.join(
          'src',
          'lib',
          'components',
          'events',
          'EventMoreMenu.svelte',
        ),
        message: 'removed transitional path must stay absent',
      },
      {
        file: path.join('src', 'lib', 'tabs', 'followees', 'FolloweesTab.svelte'),
        message: 'removed transitional path must stay absent',
      },
    ]);
  });
});

async function write(root: string, rel: string, text: string): Promise<void> {
  const file = path.join(root, rel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text);
}
