import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

export type Problem = { file: string; message: string };

export async function checkLiveQueryOwnership(
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

    checkLiveQueryCalls(problems, rel, source, text);
  }

  return problems;
}

function checkLiveQueryCalls(
  problems: Problem[],
  file: string,
  source: ts.SourceFile,
  fullText: string,
) {
  const lines = fullText.split('\n');

  source.forEachChild(function visit(node) {
    if (ts.isCallExpression(node)) {
      const methodName = node.expression.getText(source);
      if (methodName === 'liveQuery') {
        const lineNum = source.getLineAndColumnOfPosition(node.pos).line;
        const precedingLines = lines.slice(
          Math.max(0, lineNum - 10),
          lineNum + 1,
        );
        const context = precedingLines.join('\n');

        const hasUnsubscribe = /subscribe|unsubscribe|dispose|capture|close/.test(context);

        if (!hasUnsubscribe) {
          problems.push({
            file,
            message: `liveQuery at line ${lineNum + 1} requires captured cleanup ownership (subscribe/dispose stored and called)`,
          });
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