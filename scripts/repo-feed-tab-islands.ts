import fs from 'node:fs/promises';
import path from 'node:path';

type Problem = { file: string; message: string };
type FeedTabModule = {
  path: string;
  importSuffix: string;
  file: string;
  tag?: string;
};

const productExts = new Set(['.js', '.svelte', '.ts']);
const retainedFeedModules: readonly FeedTabModule[] = [
  feedTabModule({
    path: path.join('src', 'lib', 'tabs', 'timeline', 'TimelineTab.svelte'),
    tag: 'TimelineTab',
  }),
  feedTabModule({
    path: path.join(
      'src',
      'lib',
      'tabs',
      'timeline',
      'TimelineTabFollowMissing.svelte',
    ),
    tag: 'TimelineTabFollowMissing',
  }),
  feedTabModule({
    path: path.join(
      'src',
      'lib',
      'tabs',
      'timeline',
      'timeline-tab-lifecycle.ts',
    ),
  }),
  feedTabModule({
    path: path.join(
      'src',
      'lib',
      'tabs',
      'timeline',
      'timeline-tab-runtime-create.ts',
    ),
  }),
  feedTabModule({
    path: path.join('src', 'lib', 'tabs', 'profile', 'ProfileTab.svelte'),
    tag: 'ProfileTab',
  }),
  feedTabModule({
    path: path.join(
      'src',
      'lib',
      'tabs',
      'notifications',
      'NotificationsTab.svelte',
    ),
    tag: 'NotificationsTab',
  }),
  feedTabModule({
    path: path.join('src', 'lib', 'tabs', 'thread', 'ThreadTab.svelte'),
    tag: 'ThreadTab',
  }),
  feedTabModule({
    path: path.join('src', 'lib', 'tabs', 'search', 'SearchTab.svelte'),
    tag: 'SearchTab',
  }),
  feedTabModule({
    path: path.join(
      'src',
      'lib',
      'tabs',
      'custom-request',
      'CustomRequestTab.svelte',
    ),
    tag: 'CustomRequestTab',
  }),
] as const;
const deletedFeedModules: readonly FeedTabModule[] = [
  feedTabModule({
    path: path.join(
      'src',
      'lib',
      'tabs',
      'author-context',
      'AuthorContextTab.svelte',
    ),
    tag: 'AuthorContextTab',
  }),
  feedTabModule({
    path: path.join(
      'src',
      'lib',
      'tabs',
      'user-timeline',
      'UserTimelineTab.svelte',
    ),
    tag: 'UserTimelineTab',
  }),
  feedTabModule({
    path: path.join('src', 'lib', 'tabs', 'followees'),
    file: 'tabs/followees',
  }),
] as const;
const feedTabModules = [...retainedFeedModules, ...deletedFeedModules];
const retainedPaths = new Set(retainedFeedModules.map((item) => item.path));
const deletedPaths = new Set(deletedFeedModules.map((item) => item.path));

export async function checkFeedTabIslandGuard(
  root: string,
  files: string[],
): Promise<Problem[]> {
  const problems: Problem[] = [];
  for (const file of files) {
    const rel = path.relative(root, file);
    if (
      !isProductSource(rel) ||
      retainedPaths.has(rel) ||
      deletedPaths.has(rel)
    )
      continue;
    const text = await fs.readFile(file, 'utf8');
    for (const guarded of feedTabModules) {
      if (guarded.tag && new RegExp(`<${guarded.tag}(?:\\s|>)`).test(text)) {
        problems.push({
          file: rel,
          message: `${guarded.tag} must not be mounted by product source`,
        });
      }
      if (text.includes(guarded.file) || text.includes(guarded.importSuffix)) {
        problems.push({
          file: rel,
          message: `${guarded.file} must not be imported by product source`,
        });
      }
    }
  }
  return problems;
}

function isProductSource(rel: string): boolean {
  return rel.startsWith(`src${path.sep}`) && productExts.has(path.extname(rel));
}

function feedTabModule(input: {
  path: string;
  file?: string;
  tag?: string;
}): FeedTabModule {
  return {
    ...input,
    importSuffix: input.path
      .replace(path.join('src', 'lib') + path.sep, '')
      .replace(path.extname(input.path), ''),
    file: input.file ?? path.basename(input.path),
  };
}
