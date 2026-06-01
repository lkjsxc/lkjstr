import fs from 'node:fs/promises';
import path from 'node:path';

export type ComposeProblem = { file: string; message: string };

export async function checkComposeGuardrails(
  root: string,
): Promise<ComposeProblem[]> {
  const problems: ComposeProblem[] = [];
  const hasLegacyCompose = await fs
    .access(path.join(root, 'compose.yaml'))
    .then(() => true)
    .catch(() => false);
  if (hasLegacyCompose)
    problems.push({ file: 'compose.yaml', message: 'use docker-compose.yml' });
  const text = await fs
    .readFile(path.join(root, 'docker-compose.yml'), 'utf8')
    .catch(() => '');
  if (!text) return [{ file: 'docker-compose.yml', message: 'missing' }];
  const services = serviceNames(text);
  for (const service of ['app', 'verify', 'e2e', 'cloudflare', 'app-smoke']) {
    if (!services.has(service))
      problems.push({
        file: 'docker-compose.yml',
        message: `missing ${service} service`,
      });
  }
  const checks: [RegExp, string][] = [
    [/^\s*develop\s*:/m, 'defines Compose develop'],
    [/^\s*watch\s*:/m, 'defines Compose watch sync'],
    [/^\s*environment\s*:/m, 'defines Compose environment'],
    [/^\s*-\s*(?:\.|\.\.?\/[^:]+):/m, 'mounts the source tree'],
    [/^\s*source\s*:\s*(?:\.|\.\.?\/)/m, 'mounts the source tree'],
  ];
  for (const [pattern, message] of checks) {
    if (pattern.test(text))
      problems.push({ file: 'docker-compose.yml', message });
  }
  const dockerfile = await fs
    .readFile(path.join(root, 'Dockerfile'), 'utf8')
    .catch(() => '');
  if (
    !/FROM deps AS app[\s\S]*RUN pnpm build[\s\S]*CMD \["pnpm", "preview"/.test(
      dockerfile,
    )
  )
    problems.push({
      file: 'Dockerfile',
      message: 'app target must run preview',
    });
  if (
    !/FROM app AS app-smoke[\s\S]*CMD \["pnpm", "exec", "tsx", "scripts\/app-smoke\.ts"\]/.test(
      dockerfile,
    )
  )
    problems.push({
      file: 'Dockerfile',
      message: 'app-smoke target must run app smoke',
    });
  if (
    !/FROM deps AS verify[\s\S]*CMD \["cargo", "run", "-p", "lkjstr-xtask", "--", "quiet", "verify"\]/.test(
      dockerfile,
    )
  )
    problems.push({
      file: 'Dockerfile',
      message: 'verify target must run xtask quiet verify',
    });
  for (const token of [
    'rustup show',
    'cargo install trunk',
    'cargo install wasm-pack',
  ]) {
    if (!dockerfile.includes(token))
      problems.push({
        file: 'Dockerfile',
        message: `missing Docker Rust/WASM tool ${token}`,
      });
  }
  const playwright = await fs
    .readFile(path.join(root, 'playwright.config.ts'), 'utf8')
    .catch(() => '');
  if (!playwright.includes('pnpm build && pnpm preview'))
    problems.push({
      file: 'playwright.config.ts',
      message: 'e2e webServer must use production preview',
    });
  return problems;
}

function serviceNames(text: string): Set<string> {
  const names = new Set<string>();
  const match = /^services:\n([\s\S]*)/m.exec(text);
  if (!match) return names;
  for (const line of match[1].split(/\r?\n/)) {
    const item = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (item) names.add(item[1]);
  }
  return names;
}
