import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkDeletedPaths } from '../../scripts/repo-deleted-paths';

describe('repo deleted path guard', () => {
  it('rejects removed transitional paths without blocking retained helpers', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-deleted-'));
    await write(
      root,
      'src/lib/tabs/followees/followees-scroll-rows.ts',
      'export const oldHelper = true;',
    );
    await write(
      root,
      'src/lib/user-timeline/user-timeline-route-plan.ts',
      'export const oldRoutePlan = true;',
    );
    await write(
      root,
      'src/lib/cache/event-store.ts',
      'export const oldEventStore = true;',
    );
    await write(
      root,
      'src/lib/telemetry/runtime-health.ts',
      'export const oldRuntimeHealth = true;',
    );
    await write(
      root,
      'src/lib/tweet/media-upload-providers.ts',
      'export const oldTweetProviderReexport = true;',
    );
    await write(
      root,
      'src/lib/workspace/split-commands.ts',
      'export const oldSplitCommands = true;',
    );
    await write(
      root,
      'src/lib/feed-surface/staged-rows.ts',
      'export const oldStagedRows = true;',
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
        file: path.join('src', 'lib', 'cache', 'event-store.ts'),
        message: 'removed transitional path must stay absent',
      },
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
        file: path.join('src', 'lib', 'feed-surface', 'staged-rows.ts'),
        message: 'removed transitional path must stay absent',
      },
      {
        file: path.join('src', 'lib', 'tabs', 'followees'),
        message: 'removed transitional path must stay absent',
      },
      {
        file: path.join('src', 'lib', 'telemetry', 'runtime-health.ts'),
        message: 'removed transitional path must stay absent',
      },
      {
        file: path.join('src', 'lib', 'tweet', 'media-upload-providers.ts'),
        message: 'removed transitional path must stay absent',
      },
      {
        file: path.join(
          'src',
          'lib',
          'user-timeline',
          'user-timeline-route-plan.ts',
        ),
        message: 'removed transitional path must stay absent',
      },
      {
        file: path.join('src', 'lib', 'workspace', 'split-commands.ts'),
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
