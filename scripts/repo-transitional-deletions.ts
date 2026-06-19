import fs from 'node:fs/promises';
import path from 'node:path';

type Problem = { file: string; message: string };
type DeletedHelper = {
  path: string;
  pattern: RegExp;
  message: string;
};

const productExts = new Set(['.js', '.svelte', '.ts']);
const deletedHelpers: readonly DeletedHelper[] = [
  {
    path: path.join('src', 'lib', 'cache', 'event-store.ts'),
    pattern: /event-store/,
    message: 'deleted cache event-store helper must not be imported',
  },
  {
    path: path.join('src', 'lib', 'telemetry', 'runtime-health.ts'),
    pattern: /runtime-health/,
    message: 'deleted telemetry runtime-health shim must not be imported',
  },
  {
    path: path.join('src', 'lib', 'tweet', 'media-upload-providers.ts'),
    pattern: /media-upload-providers/,
    message: 'deleted tweet media-upload provider helper must not be imported',
  },
  {
    path: path.join('src', 'lib', 'workspace', 'split-commands.ts'),
    pattern: /split-commands/,
    message: 'deleted workspace split-commands helper must not be imported',
  },
] as const;
const deletedPaths = new Set(deletedHelpers.map((item) => item.path));

export async function checkTransitionalDeletionGuard(
  root: string,
  files: string[],
): Promise<Problem[]> {
  const problems: Problem[] = [];
  for (const file of files) {
    const rel = path.relative(root, file);
    if (!isProductSource(rel) || deletedPaths.has(rel)) continue;
    const text = await fs.readFile(file, 'utf8');
    for (const deleted of deletedHelpers) {
      if (deleted.pattern.test(text)) {
        problems.push({ file: rel, message: deleted.message });
      }
    }
  }
  return problems;
}

function isProductSource(rel: string): boolean {
  return rel.startsWith(`src${path.sep}`) && productExts.has(path.extname(rel));
}
