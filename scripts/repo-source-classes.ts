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
    if (!['.ts', '.js'].includes(path.extname(rel))) continue;
    const source = ts.createSourceFile(
      rel,
      await fs.readFile(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
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

function allowedDexieClass(rel: string, node: ts.ClassDeclaration): boolean {
  if (rel !== dexieException) return false;
  if (node.name?.text !== 'LkjstrDb') return false;
  return (
    node.heritageClauses?.some((clause) =>
      clause.types.some((type) => type.expression.getText() === 'Dexie'),
    ) ?? false
  );
}
