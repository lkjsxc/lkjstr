import fs from 'node:fs/promises';
import path from 'node:path';

type Problem = { file: string; message: string };

const deletedPaths = [
  path.join('src', 'lib', 'author-context'),
  path.join('src', 'lib', 'components', 'events', 'EventMoreMenu.svelte'),
  path.join('src', 'lib', 'tabs', 'author-context', 'AuthorContextTab.svelte'),
  path.join('src', 'lib', 'tabs', 'followees', 'FolloweesTab.svelte'),
  path.join('src', 'lib', 'tabs', 'user-timeline', 'UserTimelineTab.svelte'),
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
