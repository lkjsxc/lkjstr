import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkEventMenuGuard } from '../../scripts/repo-event-menu';

describe('repo event menu guard', () => {
  it('rejects product mounts of the deleted EventMoreMenu component', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-menu-'));
    const row = await write(
      root,
      'src/lib/components/events/EventRow.svelte',
      '<script>import EventMoreMenu from "./EventMoreMenu.svelte";</script>',
    );
    const target = await write(
      root,
      'src/lib/components/events/EventMoreMenu.svelte',
      '<button>Copy event id</button>',
    );

    await expect(checkEventMenuGuard(root, [row, target])).resolves.toEqual([
      {
        file: path.join(
          'src',
          'lib',
          'components',
          'events',
          'EventRow.svelte',
        ),
        message:
          'deleted EventMoreMenu.svelte must not be mounted by product source',
      },
    ]);
  });

  it('rejects product imports of the deleted event menu helper', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-menu-'));
    const meta = await write(
      root,
      'src/lib/components/events/EventMeta.svelte',
      '<script>import { copyEventStatusLabel } from "./event-more-menu";</script>',
    );
    const helper = await write(
      root,
      'src/lib/components/events/event-more-menu.ts',
      'export const copyEventStatusLabel = "Copied";',
    );

    await expect(checkEventMenuGuard(root, [meta, helper])).resolves.toEqual([
      {
        file: path.join(
          'src',
          'lib',
          'components',
          'events',
          'EventMeta.svelte',
        ),
        message: 'deleted event-more-menu.ts helper must not be imported',
      },
    ]);
  });

  it('rejects reintroduced deleted event menu helper symbols', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-menu-'));
    const helper = await write(
      root,
      'src/lib/components/events/copied-menu-helper.ts',
      [
        'export type EventMoreMenuCopyStatus = { kind: "copied" };',
        'export const copyEventStatusLabel = () => "Copied";',
      ].join('\n'),
    );

    await expect(checkEventMenuGuard(root, [helper])).resolves.toEqual([
      {
        file: path.join(
          'src',
          'lib',
          'components',
          'events',
          'copied-menu-helper.ts',
        ),
        message:
          'deleted event-more-menu.ts helper API must not be reintroduced',
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
