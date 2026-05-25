import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

export type Problem = { file: string; message: string };

const VALID_STATIC_KEYS = new Set([
  'subscription-manager',
  'timeline',
  'timeline:global',
  'timeline:home',
]);

export async function checkRuntimeCounters(
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
    const source = ts.createSourceFile(
      rel,
      ext === '.svelte' ? svelteScriptText(text) : text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    checkDynamicCounterKey(problems, rel, source);
  }

  return problems;
}

function checkDynamicCounterKey(
  problems: Problem[],
  file: string,
  source: ts.SourceFile,
) {
  source.forEachChild(function visit(node) {
    if (ts.isCallExpression(node) && node.arguments.length >= 1) {
      const fnName = node.expression.getText(source);
      if (fnName === 'countRuntime' || fnName === 'setRuntimeCounterActive') {
        const keyArg = node.arguments[0];
        if (!isStaticKey(keyArg, source)) {
          problems.push({
            file,
            message: `runtime counter call uses non-static key (must be one of: ${[...VALID_STATIC_KEYS].join(', ')})`,
          });
        }
      }
    }
    node.forEachChild(visit);
  });
}

function isStaticKey(node: ts.Node, source: ts.SourceFile): boolean {
  if (ts.isStringLiteral(node)) return VALID_STATIC_KEYS.has(node.text);
  if (ts.isNumericLiteral(node)) return true;
  if (ts.isIdentifier(node)) return VALID_STATIC_KEYS.has(node.text);
  if (ts.isConditionalExpression(node)) {
    return isStaticKey(node.whenTrue, source) && isStaticKey(node.whenFalse, source);
  }
  return false;
}

function svelteScriptText(source: string): string {
  return [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/giu)]
    .map((match) => match[1] ?? '')
    .join('\n');
}
