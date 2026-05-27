import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isSkippedGeneratedPath,
  walkDirs,
} from '../../scripts/repo-doc-helpers';

const skipDirs = new Set(['data', 'node_modules']);

describe('repository doc helpers', () => {
  it('skips root generated data without skipping docs architecture data', () => {
    expect(isSkippedGeneratedPath('data', skipDirs)).toBe(true);
    expect(isSkippedGeneratedPath(path.join('data', 'cache'), skipDirs)).toBe(
      true,
    );
    expect(
      isSkippedGeneratedPath(
        path.join('docs', 'architecture', 'data'),
        skipDirs,
      ),
    ).toBe(false);
  });

  it('walks docs architecture data while excluding root data', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-docs-'));
    await fs.mkdir(path.join(root, 'data'), { recursive: true });
    await fs.mkdir(path.join(root, 'docs', 'architecture', 'data'), {
      recursive: true,
    });
    const dirs = (await walkDirs(root, skipDirs)).map((dir) =>
      path.relative(root, dir),
    );
    expect(dirs).toContain(path.join('docs', 'architecture', 'data'));
    expect(dirs).not.toContain('data');
  });
});
