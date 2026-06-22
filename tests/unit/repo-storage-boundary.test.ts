import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkStorageBoundary } from '../../scripts/repo-storage-boundary';

describe('repo storage boundary guard', () => {
  it('keeps raw browser storage behind storage-owned paths', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-storage-'));
    const feature = await write(
      root,
      'src/lib/feature/raw.ts',
      'globalThis.indexedDB.open("lkjstr");',
    );
    const storage = await write(
      root,
      'src/lib/storage/raw.ts',
      'globalThis.indexedDB.open("lkjstr");',
    );

    await expect(
      checkStorageBoundary(root, [feature, storage]),
    ).resolves.toEqual([
      {
        file: path.join('src', 'lib', 'feature', 'raw.ts'),
        message: 'raw browser storage access must stay behind repositories',
      },
    ]);
  });

  it('keeps raw SQLite WASM and OPFS opens in sqlite-opfs glue', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-opfs-'));
    const search = await write(
      root,
      'src/lib/search/raw.ts',
      'import sqlite3InitModule from "@sqlite.org/sqlite-wasm";',
    );
    const panel = await write(
      root,
      'src/lib/tabs/stats/Panel.svelte',
      '<script>await navigator.storage.getDirectory();</script>',
    );
    const worker = await write(
      root,
      'src/lib/storage/sqlite-opfs/open-database.ts',
      'await navigator.storage.getDirectory();',
    );

    await expect(
      checkStorageBoundary(root, [search, panel, worker]),
    ).resolves.toEqual([
      {
        file: path.join('src', 'lib', 'search', 'raw.ts'),
        message:
          'raw SQLite or OPFS access must stay behind sqlite-opfs worker glue',
      },
      {
        file: path.join('src', 'lib', 'tabs', 'stats', 'Panel.svelte'),
        message:
          'raw SQLite or OPFS access must stay behind sqlite-opfs worker glue',
      },
    ]);
  });

  it('keeps SQLite OPFS imports in approved adapters and diagnostics', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-opfs-'));
    const feature = await write(
      root,
      'src/lib/profile/raw.ts',
      "import { sendSqliteStorage } from '$lib/storage/sqlite-opfs/kernel-client';",
    );
    const stats = await write(
      root,
      'src/lib/tabs/stats/Stats.svelte',
      "import { readSqliteStorageHealth } from '$lib/storage/sqlite-opfs/storage-health';",
    );
    const route = await write(
      root,
      'src/routes/+page.svelte',
      "import { closeSqliteStorage } from '$lib/storage/sqlite-opfs/kernel-client';",
    );

    await expect(
      checkStorageBoundary(root, [feature, stats, route]),
    ).resolves.toEqual([
      {
        file: path.join('src', 'lib', 'profile', 'raw.ts'),
        message:
          'SQLite OPFS imports must stay in approved adapters, repositories, or diagnostics',
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
