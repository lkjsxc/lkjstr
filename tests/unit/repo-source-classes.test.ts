import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkSourceClasses } from '../../scripts/repo-source-classes';

describe('repo source class guard', () => {
  it('rejects first-party source classes', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-classes-'));
    const source = path.join(root, 'src', 'lib', 'feature.ts');
    const storage = path.join(root, 'src', 'lib', 'storage', 'bad.ts');
    const test = path.join(root, 'tests', 'unit', 'fake.ts');
    await fs.mkdir(path.dirname(source), { recursive: true });
    await fs.mkdir(path.dirname(storage), { recursive: true });
    await fs.mkdir(path.dirname(test), { recursive: true });
    await fs.writeFile(source, 'class SourceClass {}');
    await fs.writeFile(storage, 'class StorageClass {}');
    await fs.writeFile(test, 'class FakeClass {}');

    await expect(
      checkSourceClasses(root, [source, storage, test]),
    ).resolves.toEqual([
      {
        file: path.join('src', 'lib', 'feature.ts'),
        message: expect.any(String),
      },
      {
        file: path.join('src', 'lib', 'storage', 'bad.ts'),
        message: expect.any(String),
      },
    ]);
  });

  it('scans Svelte script blocks but ignores markup classes', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-svelte-'));
    const source = path.join(root, 'src', 'lib', 'Widget.svelte');
    await fs.mkdir(path.dirname(source), { recursive: true });
    await fs.writeFile(
      source,
      '<script lang="ts">class ScriptClass {}</script><div class="visual"></div>',
    );

    await expect(checkSourceClasses(root, [source])).resolves.toEqual([
      {
        file: path.join('src', 'lib', 'Widget.svelte'),
        message: expect.any(String),
      },
    ]);
  });

  it('rejects deprecated source aliases', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-deprecated-'));
    const source = path.join(root, 'src', 'lib', 'feature.ts');
    await fs.mkdir(path.dirname(source), { recursive: true });
    await fs.writeFile(
      source,
      '/** @deprecated use direct export */\nexport const oldName = 1;',
    );

    await expect(checkSourceClasses(root, [source])).resolves.toEqual([
      {
        file: path.join('src', 'lib', 'feature.ts'),
        message: 'first-party src must not expose deprecated aliases',
      },
    ]);
  });
});
