import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

export type Problem = { file: string; message: string };

export async function checkUnboundedTimers(
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

    checkTimerOwnership(problems, rel, source, text);
  }

  return problems;
}

interface TimerUsage {
  name: string;
  line: number;
  hasStoredRef: boolean;
  hasClearCall: boolean;
}

function checkTimerOwnership(
  problems: Problem[],
  file: string,
  source: ts.SourceFile,
  fullText: string,
) {
  const usages = findTimerUsages(source, fullText);
  if (usages.length === 0) return;

  for (const usage of usages) {
    if (usage.hasClearCall || usage.hasStoredRef) continue;
    const clearName =
      usage.name === 'addEventListener'
        ? 'removeEventListener'
        : usage.name === 'setInterval'
          ? 'clearInterval'
          : 'clearTimeout';
    problems.push({
      file,
      message: `${usage.name} at line ${usage.line + 1} requires captured cleanup ownership (stored ref with ${clearName} called on dispose)`,
    });
  }
}

function findTimerUsages(
  source: ts.SourceFile,
  fullText: string,
): TimerUsage[] {
  const usages: TimerUsage[] = [];
  const lines = fullText.split('\n');
  const timerNames = ['setInterval', 'setTimeout', 'addEventListener'];

  source.forEachChild(function visit(node) {
    if (ts.isCallExpression(node)) {
      const fnName = node.expression.getText(source);
      if (timerNames.includes(fnName)) {
        const lineNum = ts.getLineAndCharacterOfPosition(source, node.pos).line;
        const lineText = lines[lineNum] ?? '';
        if (fnName === 'setTimeout' && lineText.includes('new Promise')) {
          return;
        }

        if (
          fnName === 'setTimeout' &&
          lineText.includes('resolve') &&
          lineText.includes('0')
        ) {
          return;
        }

        usages.push({
          name: fnName,
          line: lineNum,
          hasStoredRef: false,
          hasClearCall: false,
        });
      }
    }
    node.forEachChild(visit);
  });

  for (const usage of usages) {
    const lineText = lines[usage.line];
    if (!lineText) continue;
    if (
      /\btimer\s*=/.test(lineText) ||
      /\btimers?\s*=/.test(lineText) ||
      /=\s*set(?:Interval|Timeout)/.test(lineText)
    ) {
      usage.hasStoredRef = true;
    }
  }

  if (usages.length > 0) {
    if (
      fullText.includes('clearInterval') ||
      fullText.includes('clearTimeout') ||
      fullText.includes('removeEventListener')
    ) {
      for (const u of usages) u.hasClearCall = true;
    }
  }

  return usages;
}

function svelteScriptText(source: string): string {
  return [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/giu)]
    .map((match) => match[1] ?? '')
    .join('\n');
}
