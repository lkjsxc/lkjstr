// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

type Entry = [string, string | Buffer];
const checker = new URL('../scripts/package-check.py', import.meta.url).pathname;
const wasm = Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]);
const graph = (script: string, extra: Entry[] = [], preload = false): Entry[] => [
  ['index.html', `${preload ? '<link href="/engine.wasm">' : ''}<script src="/app.js"></script>`],
  ['app.js', script],
  ['engine.wasm', wasm],
  ...extra,
];
const check = (entries: Entry[]) => {
  const tar = spawnSync(
    'python3',
    [
      '-I',
      '-c',
      `import base64,io,json,sys,tarfile
out=io.BytesIO()
with tarfile.open(fileobj=out,mode='w') as tar:
 for name,body in json.load(sys.stdin):
  data=base64.b64decode(body);entry=tarfile.TarInfo(name);entry.size=len(data)
  tar.addfile(entry,io.BytesIO(data))
sys.stdout.buffer.write(out.getvalue())`,
    ],
    {
      input: JSON.stringify(
        entries.map(([name, body]) => [name, Buffer.from(body).toString('base64')]),
      ),
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  expect(tar.status, String(tar.stderr)).toBe(0);
  return spawnSync('python3', ['-I', checker], { input: tar.stdout });
};
const accepts = (entries: Entry[]) => {
  const result = check(entries);
  expect(result.status, String(result.stderr)).toBe(0);
};
const rejects = (entries: Entry[], reason: string) => {
  const result = check(entries);
  expect(result.status, String(result.stderr)).toBe(1);
  expect(String(result.stderr)).toContain(reason);
};

describe('exact package reachable asset graph', () => {
  it.each(['Worker', 'SharedWorker'])(
    'accepts the generated app -> %s -> import -> loader URL -> WASM graph',
    (worker) => {
      accepts(
        graph(`new ${worker}('/worker.js',{type:'module'});`, [
          ['worker.js', "import init from './engine/loader.js';await init();"],
          ['engine/loader.js', "const path=new URL('../engine.wasm',import.meta.url);"],
        ]),
      );
    },
  );
  it.each([
    "import './loader.js';",
    "import init from './loader.js';",
    "export {init} from './loader.js';",
    "import('./loader.js');",
    "importScripts('./loader.js');",
  ])('follows literal module/loader form %s', (statement) => {
    accepts(graph(statement, [['loader.js', "init('/engine.wasm');"]]));
  });
  it.each([
    "new URL('/engine.wasm?version=1#module',import.meta.url);",
    "fetch('./engine.wasm');",
    "init('engine.wasm');",
  ])('accepts generated WASM URL form %s', (statement) => accepts(graph(statement)));
  it('handles a dependency cycle once and still validates its WASM edge', () => {
    accepts(
      graph("import './loader.js';", [
        ['loader.js', "import './app.js';new URL('./engine.wasm',import.meta.url);"],
      ]),
    );
  });
  it('rejects a missing transitive Worker even when direct WASM is valid', () => {
    rejects(graph("new Worker('/missing.js');", [], true), 'missing.js');
  });
  it('rejects a missing transitive module after a valid WASM edge', () => {
    rejects(graph("init('/engine.wasm');import './missing.js';"), 'missing.js');
  });
  it('rejects a mock graph with an orphan WASM and an unreferenced loader', () => {
    rejects(graph('export {};', [['orphan.js', "init('/engine.wasm');"]]), '.wasm');
  });
  it.each([
    "// new URL('/engine.wasm',import.meta.url);\nexport {};",
    "/* new URL('/engine.wasm',import.meta.url); */export {};",
    'const text="new URL(\'/engine.wasm\',import.meta.url)";',
    "const text=`new URL('/engine.wasm',import.meta.url)`;",
    'const match=/new URL\("engine.wasm"\)/;',
  ])('ignores comments, quoted text, templates and regex decoys: %s', (statement) => {
    rejects(graph(statement), '.wasm');
  });
  it('ignores HTML comments and non-executable asset links for reachability', () => {
    const entries = graph('export {};');
    entries[0]![1] += '<!-- <link href="/engine.wasm"> --><a href="/engine.wasm">download</a>';
    rejects(entries, '.wasm');
  });
  it.each(['../escape.js', '/%61pp.js', './bad\\path.js', 'bad:asset.js', 'bare.js'])(
    'rejects an unsafe or bare local module path: %s',
    (path) => rejects(graph(`import '${path}';`, [], true), 'path'),
  );
  it('rejects an invalid transitive WASM after a valid direct WASM', () => {
    rejects(graph("init('/bad.wasm');", [['bad.wasm', 'not wasm']], true), 'bad.wasm');
  });
  it('retains direct WASM checks for non-executable HTML references', () => {
    const entries = graph("init('/engine.wasm');", [['bad.wasm', 'invalid']]);
    entries[0]![1] += '<custom-tag src="/bad.wasm">';
    rejects(entries, 'bad.wasm');
  });
  it('rejects a truncated transitive WASM header', () => {
    rejects(graph("init('/bad.wasm');", [['bad.wasm', wasm.subarray(0, 7)]]), 'WASM');
  });
  it('requires reachable JavaScript to be UTF-8', () => {
    rejects(graph("import './bad.js';", [['bad.js', Buffer.from([255])]], true), 'UTF-8');
  });
  it('bounds the unique reachable graph independently of archive entry count', () => {
    const extra: Entry[] = Array.from({ length: 1024 }, (_, i) => [
      `a${i}.js`,
      i === 1023 ? "init('/engine.wasm');" : `import './a${i + 1}.js';`,
    ]);
    rejects(graph("import './a0.js';", extra), 'reachable asset limit');
  });
});
