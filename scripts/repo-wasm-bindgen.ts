import fs from 'node:fs/promises';
import path from 'node:path';

export type RepoWasmBindgenProblem = { file: string; message: string };

export async function checkWasmBindgenInlineJs(
  root: string,
  files: readonly string[],
): Promise<RepoWasmBindgenProblem[]> {
  const problems: RepoWasmBindgenProblem[] = [];
  for (const file of files) {
    const rel = path.relative(root, file);
    if (!isProductRust(rel)) continue;
    const text = await fs.readFile(file, 'utf8');
    if (/wasm_bindgen\s*\(\s*inline_js\s*=/.test(text)) {
      problems.push({
        file: rel,
        message:
          'product wasm_bindgen inline_js must not create untracked snippet assets',
      });
    }
  }
  return problems;
}

function isProductRust(rel: string): boolean {
  return rel.startsWith(`crates${path.sep}`) && rel.endsWith('.rs');
}
