// Build: node scripts/build.ts [--watch] [--engine=<dir>]. Writes the static site to ../dist: one HTML file, hashed
// scripts and styles, no inline script (the host's CSP is `script-src 'self' 'wasm-unsafe-eval'`).
// Without --engine the mock engine is bundled as the worker. With it, <dir>/engine.js (a module worker) and
// <dir>/*.wasm are published under hashed names; `__ENGINE_WASM__` in engine.js becomes the wasm's address.
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  watch as fsWatch,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import * as esbuild from 'esbuild';

const here = new URL('..', import.meta.url).pathname;
const out = join(here, '..', 'dist');
const watch = process.argv.includes('--watch');
const engineDir = process.argv.find((a) => a.startsWith('--engine='))?.slice(9);
const CSS = ['ui.css', 'notes.css', 'views.css', 'people.css', 'pages.css'];
const STATIC = ['icon.svg', 'icon-192.png', 'icon-512.png', 'favicon.ico', 'manifest.webmanifest'];

const hashed = (name: string, ext: string, body: string | Uint8Array): string =>
  `${name}-${createHash('sha256').update(body).digest('hex').slice(0, 16)}.${ext}`;
const emit = (name: string, body: string | Uint8Array): string => {
  writeFileSync(join(out, name), body);
  return `/${name}`;
};
const git = (): string => {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: here, stdio: 'pipe' }).toString().trim();
  } catch {
    return 'unknown';
  }
};

async function bundle(
  entry: string,
  define: Record<string, string>,
  iife = false,
): Promise<string> {
  const r = await esbuild.build({
    entryPoints: [join(here, entry)],
    bundle: true,
    write: false,
    target: ['chrome120', 'firefox128', 'safari17'],
    format: iife ? 'iife' : 'esm',
    minify: !watch,
    sourcemap: watch ? 'inline' : false,
    define,
    logLevel: 'warning',
    legalComments: 'none',
  });
  return r.outputFiles[0]?.text ?? '';
}

async function build(): Promise<void> {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const { version } = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8')) as {
    version: string;
  };
  const define = { __VERSION__: JSON.stringify(version), __COMMIT__: JSON.stringify(git()) };

  let engine: string;
  let wasm = '';
  if (engineDir) {
    const file = readdirSync(engineDir).find((n) => n.endsWith('.wasm'));
    if (!file) throw new Error(`no .wasm in ${engineDir}`);
    const bytes = readFileSync(join(engineDir, file));
    wasm = emit(hashed('engine', 'wasm', bytes), bytes);
    const js = readFileSync(join(engineDir, 'engine.js'), 'utf8').replaceAll(
      '__ENGINE_WASM__',
      wasm,
    );
    engine = emit(hashed('engine', 'js', js), js);
  } else {
    const js = await bundle('src/engine/mock/worker.ts', define);
    engine = emit(hashed('engine', 'js', js), js);
  }

  const cssText = CSS.map((f) => readFileSync(join(here, 'src/ui', f), 'utf8')).join('\n');
  const css = (await esbuild.transform(cssText, { loader: 'css', minify: !watch })).code;
  const boot = await bundle('src/boot.ts', define, true);
  const app = await bundle('src/main.ts', { ...define, __ENGINE_URL__: JSON.stringify(engine) });
  const html = readFileSync(join(here, 'src/index.html'), 'utf8')
    .replace('__CSS__', emit(hashed('app', 'css', css), css))
    .replace('__BOOT__', emit(hashed('boot', 'js', boot), boot))
    .replace('__APP__', emit(hashed('app', 'js', app), app))
    .replace(
      '__PRELOAD__',
      wasm
        ? `<link rel="preload" href="${wasm}" as="fetch" type="application/wasm" crossorigin />`
        : '',
    );
  writeFileSync(join(out, 'index.html'), html);
  for (const f of STATIC) copyFileSync(join(here, '..', 'static', f), join(out, f));
  copyFileSync(join(here, 'src/static/privacy.html'), join(out, 'privacy.html'));
  copyFileSync(join(here, '..', 'LICENSE'), join(out, 'LICENSE.txt'));
}

await build();
if (watch) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  fsWatch(join(here, 'src'), { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => void build().then(() => console.log('rebuilt'), console.error), 150);
  });
  console.log('watching');
} else console.log('ok build');
