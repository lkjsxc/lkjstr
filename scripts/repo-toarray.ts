import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

export type Problem = { file: string; message: string };

const LARGE_TABLE_NAMES = new Set(['events', 'feedCursors']);

export async function checkToArrayLimits(
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

    checkToArrayCalls(problems, rel, source, text);
  }

  return problems;
}

function checkToArrayCalls(
  problems: Problem[],
  file: string,
  source: ts.SourceFile,
  fullText: string,
) {
  const lines = fullText.split('\n');

  source.forEachChild(function visit(node) {
    if (ts.isCallExpression(node)) {
      const methodName = node.expression.getText(source);
      if (methodName === 'toArray') {
        const pos = node.pos;
        const lineNum = source.getLineAndColumnOfPosition(pos).line;
        const precedingLines = lines.slice(
          Math.max(0, lineNum - 5),
          lineNum + 1,
        );
        const context = precedingLines.join('\n');

        const hasLimitNearby =
          context.includes('.limit(') ||
          context.includes('.offset(') ||
          /\blimit\s*\(/.test(context);

        const chainExpr = node.expression;
        if (ts.isPropertyAccessExpression(chainExpr)) {
          const objText = chainExpr.expression.getText(source);
          const isLargeTable = LARGE_TABLE_NAMES.has(objText);

          if (isLargeTable && !hasLimitNearby) {
            problems.push({
              file,
              message: `toArray() on '${objText}' at line ${lineNum + 1} requires a .limit() within 5 lines`,
            });
          }
        }
      }
    }
    node.forEachChild(visit);
  });
}

function svelteScriptText(source: string): string {
  return [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/giu)]
    .map((match) => match[1] ?? '')
    .join('\n');
}
