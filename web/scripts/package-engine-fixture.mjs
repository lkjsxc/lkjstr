// Fresh package-command fixture; no shared dist or archive extraction.
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import {
  productionBindings as bindings,
  productionWasm as wasm,
} from '../tests/package-production-fixture.ts';

const root = resolve(new URL('../..', import.meta.url).pathname);
export function fixture(binary = wasm(), script = bindings, extra = {}) {
  mkdirSync(join(root, 'tmp'), { recursive: true });
  const dir = mkdtempSync(join(root, 'tmp/package-engine-'));
  try {
    mkdirSync(join(dir, 'web/scripts'), { recursive: true });
    mkdirSync(join(dir, 'scripts'));
    mkdirSync(join(dir, 'dist'));
    for (const name of readdirSync(join(root, 'web/scripts')))
      if (/^package.*\.(?:ts|py)$/.test(name))
        copyFileSync(join(root, 'web/scripts', name), join(dir, 'web/scripts', name));
    copyFileSync(
      join(root, 'scripts/engine-production.ts'),
      join(dir, 'scripts/engine-production.ts'),
    );
    symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'), 'dir');
    writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
    const files = {
      'index.html': '<!doctype html><script type="module" src="/app.js"></script>',
      'app.js': "import './renamed-loader.js';",
      'renamed-loader.js': script,
      'renamed-data.wasm': binary,
      ...extra,
    };
    for (const [name, data] of Object.entries(files)) writeFileSync(join(dir, 'dist', name), data);
    return {
      dir,
      run() {
        return spawnSync(process.execPath, [join(dir, 'web/scripts/package.ts')], {
          cwd: dir,
          encoding: 'utf8',
          timeout: 15000,
          maxBuffer: 1024 * 1024,
        });
      },
      close() {
        rmSync(dir, { recursive: true, force: true });
      },
    };
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });
    throw error;
  }
}
