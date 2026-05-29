import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

type Problem = { file: string; message: string };

const dexieException = path.join('src', 'lib', 'storage', 'browser-db.ts');

export async function checkSourceClasses(
  root: string,
  files: readonly string[],
): Promise<Problem[]> {
  const problems: Problem[] = [];
  for (const file of files) {
    const rel = path.relative(root, file);
    if (!rel.startsWith(`src${path.sep}`)) continue;
    const ext = path.extname(rel);
    if (!['.ts', '.js', '.svelte'].includes(ext)) continue;
    const text = await fs.readFile(file, 'utf8');
    if (text.includes('@deprecated'))
      problems.push({
        file: rel,
        message: 'first-party src must not expose deprecated aliases',
      });
    const source = ts.createSourceFile(
      rel,
      ext === '.svelte' ? svelteScriptText(text) : text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    source.forEachChild(function visit(node) {
      if (ts.isClassDeclaration(node) && !allowedDexieClass(rel, node))
        problems.push({
          file: rel,
          message: 'first-party src must not declare classes',
        });
      node.forEachChild(visit);
    });
  }
  return problems;
}

function svelteScriptText(source: string): string {
  return [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/giu)]
    .map((match) => match[1] ?? '')
    .join('\n');
}

function allowedDexieClass(rel: string, node: ts.ClassDeclaration): boolean {
  if (rel !== dexieException) return false;
  if (node.name?.text !== 'LkjstrDb') return false;
  return (
    node.heritageClauses?.some((clause) =>
      clause.types.some((type) => type.expression.getText() === 'Dexie'),
    ) ?? false
  );
}
