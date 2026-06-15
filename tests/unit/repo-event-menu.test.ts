import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkEventMenuGuard } from '../../scripts/repo-event-menu';

describe('repo event menu guard', () => {
  it('rejects product mounts of the retained EventMoreMenu component', async () => {
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
        file: path.join('src', 'lib', 'components', 'events', 'EventRow.svelte'),
        message:
          'retained EventMoreMenu.svelte must not be mounted by product source',
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
