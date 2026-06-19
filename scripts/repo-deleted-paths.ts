import fs from 'node:fs/promises';
import path from 'node:path';

type Problem = { file: string; message: string };

const deletedPaths = [
  path.join('src', 'lib', 'author-context'),
  path.join('src', 'lib', 'cache', 'event-store.ts'),
  path.join('src', 'lib', 'components', 'events', 'EventMoreMenu.svelte'),
  path.join('src', 'lib', 'components', 'events', 'event-more-menu.ts'),
  path.join('src', 'lib', 'feed-surface', 'feed-geometry-estimate.ts'),
  path.join('src', 'lib', 'feed-surface', 'row-shell.ts'),
  path.join('src', 'lib', 'feed-surface', 'staged-rows.ts'),
  path.join('src', 'lib', 'tabs', 'author-context', 'AuthorContextTab.svelte'),
  path.join('src', 'lib', 'tabs', 'followees'),
  path.join('src', 'lib', 'tabs', 'user-timeline', 'UserTimelineTab.svelte'),
  path.join('src', 'lib', 'telemetry', 'runtime-health.ts'),
  path.join('src', 'lib', 'tweet', 'media-upload-providers.ts'),
  path.join('src', 'lib', 'user-timeline', 'user-timeline-route-plan.ts'),
  path.join('src', 'lib', 'workspace', 'split-commands.ts'),
];

export async function checkDeletedPaths(root: string): Promise<Problem[]> {
  const problems: Problem[] = [];
  for (const rel of deletedPaths) {
    if (await exists(path.join(root, rel))) {
      problems.push({
        file: rel,
        message: 'removed transitional path must stay absent',
      });
    }
  }
  return problems;
}

async function exists(file: string): Promise<boolean> {
  return fs
    .access(file)
    .then(() => true)
    .catch(() => false);
}
