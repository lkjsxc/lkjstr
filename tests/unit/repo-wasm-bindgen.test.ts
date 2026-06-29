import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkWasmBindgenInlineJs } from '../../scripts/repo-wasm-bindgen';

describe('wasm-bindgen inline JS guard', () => {
  it('rejects product inline_js snippets', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-inline-js-'));
    const file = path.join(root, 'crates', 'lkjstr-web', 'src', 'lib.rs');
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(
      file,
      `#[wasm_bindgen(inline_js = "export function f(){}")]
extern "C" {}
`,
    );

    await expect(checkWasmBindgenInlineJs(root, [file])).resolves.toEqual([
      {
        file: path.join('crates', 'lkjstr-web', 'src', 'lib.rs'),
        message:
          'product wasm_bindgen inline_js must not create untracked snippet assets',
      },
    ]);
  });
});
