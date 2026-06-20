import fs from 'node:fs/promises';
import path from 'node:path';

type Problem = { file: string; message: string };

const retainedNotificationsRoot = path.join('src', 'lib', 'notifications');
const productExts = new Set(['.js', '.svelte', '.ts']);
const retainedRuntimePattern =
  /['"](?:\$lib\/notifications\/notification-runtime|src\/lib\/notifications\/notification-runtime|(?:\.\.\/)+notifications\/notification-runtime)(?:\.|['"])/;

export async function checkNotificationsDeletionGuard(
  root: string,
  files: string[],
): Promise<Problem[]> {
  const problems: Problem[] = [];
  for (const file of files) {
    const rel = path.relative(root, file);
    if (!isProductSource(rel) || isRetainedNotificationsSource(rel)) continue;
    const text = await fs.readFile(file, 'utf8');
    if (retainedRuntimePattern.test(text)) {
      problems.push({
        file: rel,
        message:
          'retained notifications runtime must not be imported by product source',
      });
    }
  }
  return problems;
}

function isProductSource(rel: string): boolean {
  return rel.startsWith(`src${path.sep}`) && productExts.has(path.extname(rel));
}

function isRetainedNotificationsSource(rel: string): boolean {
  return rel.startsWith(`${retainedNotificationsRoot}${path.sep}`);
}
