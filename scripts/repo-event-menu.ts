import fs from 'node:fs/promises';
import path from 'node:path';

type Problem = { file: string; message: string };

const retainedMenu = path.join(
  'src',
  'lib',
  'components',
  'events',
  'EventMoreMenu.svelte',
);
const productExts = new Set(['.js', '.svelte', '.ts']);
const menuPattern =
  /EventMoreMenu\.svelte|import\s+EventMoreMenu|<EventMoreMenu(?:\s|>)/;

export async function checkEventMenuGuard(
  root: string,
  files: string[],
): Promise<Problem[]> {
  const problems: Problem[] = [];
  for (const file of files) {
    const rel = path.relative(root, file);
    if (!isProductSource(rel) || rel === retainedMenu) continue;
    const text = await fs.readFile(file, 'utf8');
    if (menuPattern.test(text)) {
      problems.push({
        file: rel,
        message: 'retained EventMoreMenu.svelte must not be mounted by product source',
      });
    }
  }
  return problems;
}

function isProductSource(rel: string): boolean {
  return rel.startsWith(`src${path.sep}`) && productExts.has(path.extname(rel));
}
