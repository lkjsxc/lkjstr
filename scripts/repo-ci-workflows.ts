import fs from 'node:fs/promises';
import path from 'node:path';

export type RepoCiProblem = { file: string; message: string };

const workflowDir = path.join('.github', 'workflows');
const allowedRuns = new Set([
  'pnpm install --frozen-lockfile',
  'pnpm check:repo',
]);
const forbiddenPatterns: readonly RegExp[] = [
  /playwright/i,
  /cypress/i,
  /browser[- ]workflow/i,
  /wasm-pack\s+test\s+--headless/i,
  /docker\s+compose/i,
  /wrangler\s+deploy/i,
  /cloudflare:(quiet|dry-run|deploy)/i,
  /verify:quiet/i,
  /pnpm\s+(verify|build|test|rust-wasm|cloudflare)/i,
  /pnpm\s+ci:quiet/i,
];

export async function checkAutomaticCiWorkflowGuard(
  root: string,
): Promise<RepoCiProblem[]> {
  const dir = path.join(root, workflowDir);
  const entries = await fs
    .readdir(dir, { withFileTypes: true })
    .catch(() => []);
  const problems: RepoCiProblem[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !/\.ya?ml$/.test(entry.name)) continue;
    const rel = path.join(workflowDir, entry.name);
    const text = await fs.readFile(path.join(root, rel), 'utf8');
    if (!isAutomaticWorkflow(text)) continue;
    problems.push(...checkWorkflow(rel, text));
  }
  return problems;
}

function checkWorkflow(file: string, text: string): RepoCiProblem[] {
  const problems: RepoCiProblem[] = [];
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(text)) {
      problems.push({
        file,
        message: 'automatic CI must stay repository-only',
      });
      break;
    }
  }
  for (const command of runCommands(text)) {
    if (!allowedRuns.has(command)) {
      problems.push({
        file,
        message: `automatic CI run step is not repository-only: ${command}`,
      });
    }
  }
  if (!runCommands(text).includes('pnpm check:repo')) {
    problems.push({ file, message: 'automatic CI must run pnpm check:repo' });
  }
  return problems;
}

function isAutomaticWorkflow(text: string): boolean {
  return (
    /^\s*pull_request\s*:/m.test(text) ||
    /^\s*push\s*:/m.test(text) ||
    /^\s*on\s*:\s*\[[^\]]*(push|pull_request)/im.test(text)
  );
}

function runCommands(text: string): string[] {
  const commands: string[] = [];
  for (const match of text.matchAll(/^\s*-\s*run\s*:\s*(.+?)\s*$/gm)) {
    commands.push(stripQuotes(match[1]?.trim() ?? ''));
  }
  return commands;
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
