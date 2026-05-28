import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  localMarkdownLinkProblems,
  markdownLinks,
} from '../../scripts/repo-doc-links';

describe('repository markdown link rules', () => {
  it('extracts inline links outside fenced code blocks', () => {
    const links = markdownLinks(
      [
        '[Guide](docs/guide.md)',
        '![Image](static/pic.png)',
        '```',
        '[Ignored](missing.md)',
        '```',
      ].join('\n'),
    );

    expect(links).toEqual([
      { href: 'docs/guide.md', line: 1 },
      { href: 'static/pic.png', line: 2 },
    ]);
  });

  it('ignores external links and validates local files plus anchors', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'repo-doc-links-'));
    await fs.mkdir(path.join(root, 'docs'));
    await fs.writeFile(
      path.join(root, 'docs', 'target.md'),
      '# Target\n\n## Cursor Policy\n',
    );
    const text = [
      '[External](https://example.com)',
      '[Target](docs/target.md#cursor-policy)',
      '[Missing](docs/missing.md)',
      '[Bad Anchor](docs/target.md#missing)',
    ].join('\n');

    await expect(
      localMarkdownLinkProblems(root, 'README.md', text),
    ).resolves.toEqual([
      {
        file: 'README.md',
        message: 'line 3 local link target missing: docs/missing.md',
      },
      {
        file: 'README.md',
        message: 'line 4 local link anchor missing: docs/target.md#missing',
      },
    ]);
  });
});
