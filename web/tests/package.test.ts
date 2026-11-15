// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const checker = new URL('../scripts/package-check.py', import.meta.url).pathname;
type Entry = [name: string, body: string | Buffer, type?: string];
const shell = '<link href="/engine.wasm"><script src="/app.js"></script>';
const assets: Entry[] = [
  ['app.js', 'export {};'],
  ['engine.wasm', Buffer.from([0, 97, 115, 109, 1, 0, 0, 0])],
];
// Build isolated archives in memory, including entries GNU tar normally refuses to create.
const archive = (entries: Entry[]): Buffer => {
  const result = spawnSync(
    'python3',
    [
      '-I',
      '-c',
      `import base64,io,json,sys,tarfile
out=io.BytesIO()
with tarfile.open(fileobj=out,mode='w') as tar:
 for name,body,kind in json.load(sys.stdin):
  data=base64.b64decode(body)
  entry=tarfile.TarInfo(name)
  entry.type={'file':tarfile.REGTYPE,'dir':tarfile.DIRTYPE,'link':tarfile.SYMTYPE}[kind]
  entry.size=len(data) if kind=='file' else 0
  if kind=='link': entry.linkname='app.js'
  tar.addfile(entry,io.BytesIO(data))
sys.stdout.buffer.write(out.getvalue())`,
    ],
    {
      maxBuffer: 4 * 1024 * 1024,
      input: JSON.stringify(
        entries.map(([name, body, kind = 'file']) => [
          name,
          Buffer.from(body).toString('base64'),
          kind,
        ]),
      ),
    },
  );
  expect(result.status, String(result.stderr)).toBe(0);
  return result.stdout;
};
const check = (entries: Entry[]) =>
  spawnSync('python3', ['-I', checker], { input: archive(entries) });
const valid = (html = shell, extra: Entry[] = []): Entry[] => [
  ['index.html', html],
  ...assets,
  ...extra,
];
const rejects = (entries: Entry[], file: string, reason: string) => {
  const result = check(entries);
  expect(result.status).toBe(1);
  expect(String(result.stderr)).toContain(`${file}:`);
  expect(String(result.stderr)).toContain(reason);
};

describe('release package preflight', () => {
  it('runs in the package command before writing an archive', () => {
    const temp = new URL('../../tmp/', import.meta.url).pathname;
    mkdirSync(temp, { recursive: true });
    const root = mkdtempSync(join(temp, 'package-test-'));
    try {
      mkdirSync(join(root, 'web/scripts'), { recursive: true });
      mkdirSync(join(root, 'dist'));
      for (const file of ['package.ts', 'package-check.py'])
        copyFileSync(
          new URL(`../scripts/${file}`, import.meta.url),
          join(root, 'web/scripts', file),
        );
      const wasm = 'engine-0123456789abcdef.wasm';
      writeFileSync(join(root, 'dist/index.html'), shell.replace('engine.wasm', wasm));
      writeFileSync(join(root, 'dist/app.js'), 'export {};');
      writeFileSync(join(root, 'dist', wasm), assets[1]![1]);
      const run = () => spawnSync(process.execPath, [join(root, 'web/scripts/package.ts')]);
      expect(run().status).toBe(0);
      const tar = join(root, 'tmp/lkjstr-dist.tar.gz');
      const before = readFileSync(tar);
      writeFileSync(join(root, 'dist/sitemap.xml'), '<xml/>');
      const result = run();
      expect(result.status).toBe(1);
      expect(String(result.stderr)).toContain('sitemap.xml: unsupported file suffix');
      expect(readFileSync(tar)).toEqual(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('accepts every edge suffix, nested files, root metadata and static canonical/alternates', () => {
    const suffixes =
      'html js wasm css svg png ico jpg jpeg gif webp avif woff woff2 ttf webmanifest json txt mp3 mp4 ogg webm wav'.split(
        ' ',
      );
    const entries = valid(
      `${shell}<meta property="og:url" content="https://example.com/"><!-- <script>ignored</script> -->`,
      suffixes.map((ext) => [`en/file.${ext.toUpperCase()}`, 'data']),
    );
    entries.push([
      'en/about.html',
      '<link rel="canonical" href="https://example.com/en/about.html"><link rel="alternate" hreflang="ja" href="https://example.com/ja/about.html"><script src="/app.js"></script>',
    ]);
    expect(check(entries).status).toBe(0);
  });
  it('rejects XML with its filename', () => {
    rejects(valid(shell, [['sitemap.xml', '<xml/>']]), 'sitemap.xml', 'suffix');
  });
  it.each(['map', 'gz', 'exe', ''])('rejects unsupported suffix %s', (suffix) => {
    const name = `asset${suffix ? `.${suffix}` : ''}`;
    rejects(valid(shell, [[name, 'data']]), name, 'suffix');
  });
  it('counts directories and accepts exactly 4096 entries', () => {
    const entries = valid(shell, [['.', '', 'dir']]);
    entries.push(...Array.from({ length: 4092 }, (_, i): Entry => [`d${i}`, '', 'dir']));
    expect(check(entries).status).toBe(0);
    entries.push(['overflow', '', 'dir']);
    rejects(entries, 'overflow', '4096');
  });
  it('rejects empty files even when unreferenced', () => {
    rejects(valid(shell, [['en/empty.html', '']]), 'en/empty.html', 'empty');
  });
  it('rejects duplicate files', () => {
    rejects(valid(shell, [['app.js', 'duplicate']]), 'app.js', 'duplicate');
  });
  it.each(['/absolute.txt', '../escape.txt', 'bad name.txt', '.hidden.txt', 'en/a?.txt'])(
    'rejects unsafe entry %s',
    (name) => rejects(valid(shell, [[name, 'data']]), name, 'unsafe'),
  );
  it('rejects archive links', () => {
    rejects(valid(shell, [['linked.js', '', 'link']]), 'linked.js', 'regular');
  });
  it('requires index.html at the archive root', () => {
    rejects(assets, 'index.html', 'missing');
  });
  it.each([
    'https://example.com/app.js',
    'data:text/javascript,alert(1)',
    '../app.js',
    '/app.js?v=1',
    '/app.js#fragment',
    '/%61pp.js',
    '',
  ])('rejects nonlocal index reference %s', (url) => {
    rejects(valid(`${shell}<a href="${url}">page</a>`), 'index.html', 'unsafe');
  });
  it.each(['href', 'src'])('checks %s on arbitrary tags, including missing files', (attr) => {
    rejects(valid(`${shell}<custom-tag ${attr}="/missing.png">`), 'index.html', 'missing.png');
  });
  it('accepts local references with decoded entities and case-insensitive attributes', () => {
    expect(check(valid(`${shell}<IMG SRC=/&#97;pp.js>`)).status).toBe(0);
  });
  it.each(['index.html', 'en/about.html'])('enforces CSP for %s', (name) => {
    for (const bad of [
      '<script>alert(1)</script>',
      '<script type="module">import "/app.js"</script>',
      '<script src=""></script>',
      '<img ONERROR="bad()">',
      '<div onclick>',
    ]) {
      const entries = name === 'index.html' ? valid(shell + bad) : valid(shell, [[name, bad]]);
      rejects(entries, name, bad.includes('script') ? 'inline script' : 'event attribute');
    }
  });
  it('rejects static scripts from outside the package', () => {
    rejects(
      valid(shell, [['ja/about.html', '<script src="https://example.com/a.js"></script>']]),
      'ja/about.html',
      'unsafe local path',
    );
  });
  it.each(['//app.js', '///app.js', '/&#47;app.js'])(
    'rejects network-path references before normalization: %s',
    (url) => {
      for (const attr of ['href', 'src'])
        rejects(valid(`${shell}<link ${attr}="${url}">`), 'index.html', 'unsafe local path');
      rejects(valid(shell.replace('/app.js', url)), 'index.html', 'unsafe local path');
      rejects(
        valid(shell, [['en/about.html', `<script src="${url}"></script>`]]),
        'en/about.html',
        'unsafe local path',
      );
    },
  );
  it.each(['/app.js', '../app.js', './app.js'])(
    'accepts packaged static script paths: %s',
    (src) => {
      expect(
        check(
          valid(shell, [
            ['en/about.html', `<script src="${src}"></script>`],
            ['en/app.js', 'export {};'],
          ]),
        ).status,
      ).toBe(0);
    },
  );
  it.each(['index.html', 'en/about.html', 'ja/ABOUT.HTML'])(
    'rejects custom base URLs in %s',
    (name) => {
      for (const href of ['https://example.com/', '//example.com/', '/en/']) {
        const base = `<BASE HREF="${href}">`;
        const script = '<script src="/app.js"></script>';
        for (const html of [base + script, script + base]) {
          const entries =
            name === 'index.html' ? valid(html + shell) : valid(shell, [[name, html]]);
          rejects(entries, name, 'base URL');
        }
      }
    },
  );
  it('requires referenced JS and WASM', () => {
    rejects(valid('<script src="/app.js"></script>'), 'index.html', '.wasm');
    rejects(valid('<link href="/engine.wasm">'), 'index.html', '.js');
  });
  it('checks the referenced WASM header', () => {
    rejects(
      [
        ['index.html', shell],
        ['app.js', 'export {};'],
        ['engine.wasm', 'bad'],
      ],
      'engine.wasm',
      'WASM',
    );
  });
  it('rejects non-UTF-8 HTML with its filename', () => {
    rejects(valid(shell, [['ja/about.html', Buffer.from([255])]]), 'ja/about.html', 'UTF-8');
  });
});
