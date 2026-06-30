import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkAutomaticCiWorkflowGuard } from '../../scripts/repo-ci-workflows';

describe('automatic CI workflow guard', () => {
  it('accepts repository-only automatic CI', async () => {
    const root = await fixture(`name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  repository:
    steps:
      - run: pnpm install --frozen-lockfile
      - run: pnpm check:repo
`);

    await expect(checkAutomaticCiWorkflowGuard(root)).resolves.toEqual([]);
  });

  it('rejects broad automatic gates', async () => {
    const root = await fixture(`name: CI
on: [push, pull_request]
jobs:
  verify:
    steps:
      - run: pnpm install --frozen-lockfile
      - run: pnpm verify:quiet
      - run: wasm-pack test --headless --chrome crates/lkjstr-web
`);

    const problems = await checkAutomaticCiWorkflowGuard(root);

    expect(problems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: path.join('.github', 'workflows', 'ci.yml'),
          message: 'automatic CI must stay repository-only',
        }),
        expect.objectContaining({
          message:
            'automatic CI run step is not repository-only: pnpm verify:quiet',
        }),
      ]),
    );
  });

  it('ignores manual diagnostic workflows', async () => {
    const root = await fixture(`name: Manual browser diagnostic
on:
  workflow_dispatch:
jobs:
  browser:
    steps:
      - run: wasm-pack test --headless --chrome crates/lkjstr-web
`);

    await expect(checkAutomaticCiWorkflowGuard(root)).resolves.toEqual([]);
  });

  it('keeps the checked-in CI workflow repository-only', async () => {
    await expect(checkAutomaticCiWorkflowGuard(process.cwd())).resolves.toEqual(
      [],
    );
  });

  it('keeps pnpm ci:quiet scoped to the repository gate', async () => {
    const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
    const quiet = await fs.readFile('scripts/run-quiet.ts', 'utf8');
    const ciSection = quiet.slice(
      quiet.indexOf('const ciSteps'),
      quiet.indexOf('const plans'),
    );

    expect(packageJson.scripts['ci:quiet']).toBe('tsx scripts/run-quiet.ts ci');
    expect(ciSection).toContain("args: ['check:repo']");
    expect(ciSection).not.toMatch(/verify|build|test|rust-wasm|cloudflare/);
  });
});

async function fixture(workflow: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lkjstr-ci-'));
  const dir = path.join(root, '.github', 'workflows');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'ci.yml'), workflow);
  return root;
}
