import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkNotificationsDeletionGuard } from '../../scripts/repo-notifications-deletions';

describe('repo notifications deletion guard', () => {
  it('rejects product imports of the retained notifications runtime', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-notif-'));
    const product = await write(
      root,
      'src/lib/workspace/reintroduced-notifications-runtime.ts',
      "import { createNotificationRuntime } from '../notifications/notification-runtime';",
    );

    await expect(
      checkNotificationsDeletionGuard(root, [product]),
    ).resolves.toEqual([
      {
        file: path.join(
          'src',
          'lib',
          'workspace',
          'reintroduced-notifications-runtime.ts',
        ),
        message:
          'retained notifications runtime must not be imported by product source',
      },
    ]);
  });

  it('allows retained notifications internals until deletion proof', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-notif-'));
    const retained = await write(
      root,
      'src/lib/notifications/notification-runtime.ts',
      "import { deriveNotifications } from './notification-index';",
    );

    await expect(
      checkNotificationsDeletionGuard(root, [retained]),
    ).resolves.toEqual([]);
  });

  it('allows state helpers and test-only runtime imports while retained', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-notif-'));
    const state = await write(
      root,
      'src/lib/tabs/notifications/notification-list-state.ts',
      "import type { NotificationState } from '$lib/notifications/notification-state';",
    );
    const test = await write(
      root,
      'tests/unit/notifications/runtime.test.ts',
      "import { createNotificationRuntime } from '../../../src/lib/notifications/notification-runtime';",
    );

    await expect(
      checkNotificationsDeletionGuard(root, [state, test]),
    ).resolves.toEqual([]);
  });
});

async function write(root: string, rel: string, text: string): Promise<string> {
  const file = path.join(root, rel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text);
  return file;
}
