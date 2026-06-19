import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkFeedTabIslandGuard } from '../../scripts/repo-feed-tab-islands';

describe('repo feed tab island guard', () => {
  it('rejects retained Svelte feed tab imports from product source', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-feed-tabs-'));
    const host = await write(
      root,
      'src/lib/components/workspace/PaneFeedTabBody.svelte',
      [
        '<script>',
        "import TimelineTab from '$lib/tabs/timeline/TimelineTab.svelte';",
        '</script>',
        '<TimelineTab />',
      ].join('\n'),
    );
    const retained = await write(
      root,
      'src/lib/tabs/timeline/TimelineTab.svelte',
      '<TimelineTabFollowMissing />',
    );
    const retainedHelper = await write(
      root,
      'src/lib/tabs/timeline/timeline-tab-runtime-create.ts',
      'export const createBoundTimelineTabRuntime = () => undefined;',
    );
    const product = await write(
      root,
      'src/lib/workspace/reintroduced-feed-tab.ts',
      [
        "import SearchTab from '../tabs/search/SearchTab.svelte';",
        "import { createBoundTimelineTabRuntime } from '../tabs/timeline/timeline-tab-runtime-create';",
      ].join('\n'),
    );

    await expect(
      checkFeedTabIslandGuard(root, [host, retained, retainedHelper, product]),
    ).resolves.toEqual([
      {
        file: path.join(
          'src',
          'lib',
          'components',
          'workspace',
          'PaneFeedTabBody.svelte',
        ),
        message: 'TimelineTab must not be mounted by product source',
      },
      {
        file: path.join(
          'src',
          'lib',
          'components',
          'workspace',
          'PaneFeedTabBody.svelte',
        ),
        message: 'TimelineTab.svelte must not be imported by product source',
      },
      {
        file: path.join('src', 'lib', 'workspace', 'reintroduced-feed-tab.ts'),
        message:
          'timeline-tab-runtime-create.ts must not be imported by product source',
      },
      {
        file: path.join('src', 'lib', 'workspace', 'reintroduced-feed-tab.ts'),
        message: 'SearchTab.svelte must not be imported by product source',
      },
    ]);
  });

  it('rejects extensionless retained feed tab imports', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-feed-tabs-'));
    const product = await write(
      root,
      'src/lib/workspace/profile-tab-regression.ts',
      "import ProfileTab from '../tabs/profile/ProfileTab';",
    );

    await expect(checkFeedTabIslandGuard(root, [product])).resolves.toEqual([
      {
        file: path.join('src', 'lib', 'workspace', 'profile-tab-regression.ts'),
        message: 'ProfileTab.svelte must not be imported by product source',
      },
    ]);
  });

  it('rejects deleted feed tab wrapper imports from product source', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-feed-tabs-'));
    const product = await write(
      root,
      'src/lib/workspace/deleted-feed-tabs.ts',
      [
        "import AuthorContextTab from '../tabs/author-context/AuthorContextTab.svelte';",
        "import { followeesScrollRows } from '../tabs/followees';",
      ].join('\n'),
    );
    const host = await write(
      root,
      'src/lib/components/workspace/DeletedUserTimelineMount.svelte',
      '<UserTimelineTab />',
    );
    const authorContext = await write(
      root,
      'src/lib/tabs/author-context/AuthorContextTab.svelte',
      '<p>deleted</p>',
    );
    const userTimeline = await write(
      root,
      'src/lib/tabs/user-timeline/UserTimelineTab.svelte',
      '<p>deleted</p>',
    );

    await expect(
      checkFeedTabIslandGuard(root, [
        product,
        host,
        authorContext,
        userTimeline,
      ]),
    ).resolves.toEqual([
      {
        file: path.join('src', 'lib', 'workspace', 'deleted-feed-tabs.ts'),
        message:
          'AuthorContextTab.svelte must not be imported by product source',
      },
      {
        file: path.join('src', 'lib', 'workspace', 'deleted-feed-tabs.ts'),
        message: 'tabs/followees must not be imported by product source',
      },
      {
        file: path.join(
          'src',
          'lib',
          'components',
          'workspace',
          'DeletedUserTimelineMount.svelte',
        ),
        message: 'UserTimelineTab must not be mounted by product source',
      },
    ]);
  });

  it('allows retained targets and the generic Rust island host', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-feed-tabs-'));
    const host = await write(
      root,
      'src/lib/components/workspace/PaneFeedTabBody.svelte',
      [
        '<script>',
        "import RustIslandHost from './RustIslandHost.svelte';",
        '</script>',
        '<RustIslandHost label="Home" />',
      ].join('\n'),
    );
    const retained = await write(
      root,
      'src/lib/tabs/timeline/TimelineTab.svelte',
      '<TimelineTabFollowMissing />',
    );
    const retainedHelper = await write(
      root,
      'src/lib/tabs/timeline/TimelineTabFollowMissing.svelte',
      '<p>Missing follows</p>',
    );

    await expect(
      checkFeedTabIslandGuard(root, [host, retained, retainedHelper]),
    ).resolves.toEqual([]);
  });
});

async function write(root: string, rel: string, text: string): Promise<string> {
  const file = path.join(root, rel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text);
  return file;
}
