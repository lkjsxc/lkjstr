import fs from 'node:fs/promises';
import path from 'node:path';

type Problem = { file: string; message: string };

const deletedMenu = path.join(
  'src',
  'lib',
  'components',
  'events',
  'EventMoreMenu.svelte',
);
const deletedHelper = path.join(
  'src',
  'lib',
  'components',
  'events',
  'event-more-menu.ts',
);
const productExts = new Set(['.js', '.svelte', '.ts']);
const deletedPatterns = [
  {
    pattern:
      /EventMoreMenu\.svelte|import\s+EventMoreMenu|<EventMoreMenu(?:\s|>)/,
    message:
      'deleted EventMoreMenu.svelte must not be mounted by product source',
  },
  {
    pattern: /event-more-menu/,
    message: 'deleted event-more-menu.ts helper must not be imported',
  },
  {
    pattern:
      /copyEventStatusLabel|EventMoreMenuCopyStatus|eventMoreMenuHasAuthorContext/,
    message: 'deleted event-more-menu.ts helper API must not be reintroduced',
  },
] as const;

export async function checkEventMenuGuard(
  root: string,
  files: string[],
): Promise<Problem[]> {
  const problems: Problem[] = [];
  for (const file of files) {
    const rel = path.relative(root, file);
    if (!isProductSource(rel) || rel === deletedMenu || rel === deletedHelper)
      continue;
    const text = await fs.readFile(file, 'utf8');
    for (const deleted of deletedPatterns) {
      if (deleted.pattern.test(text)) {
        problems.push({ file: rel, message: deleted.message });
        break;
      }
    }
  }
  return problems;
}

function isProductSource(rel: string): boolean {
  return rel.startsWith(`src${path.sep}`) && productExts.has(path.extname(rel));
}
