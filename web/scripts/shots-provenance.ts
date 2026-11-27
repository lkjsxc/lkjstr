import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import type { Page } from 'playwright-core';

export function createShotWriter(cwd: string) {
  const git = (...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  // One worktree snapshot per run; ignored build products do not make it dirty.
  const provenance = {
    commit: git('rev-parse', 'HEAD'),
    dirty: git('status', '--porcelain=v1', '--untracked-files=all').length > 0,
  };
  const stamp = (path: string) => writeFileSync(`${path}.json`, `${JSON.stringify(provenance)}\n`);
  return {
    stamp,
    async screenshot(
      page: Page,
      options: NonNullable<Parameters<Page['screenshot']>[0]> & { path: string },
    ) {
      await page.screenshot(options);
      stamp(options.path);
    },
  };
}

export type ShotWriter = ReturnType<typeof createShotWriter>;
