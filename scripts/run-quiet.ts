import { spawn } from 'node:child_process';
import process from 'node:process';

type Step = {
  readonly label: string;
  readonly command: string;
  readonly args: readonly string[];
};

const plans: Record<string, readonly Step[]> = {
  test: [
    {
      label: 'unit',
      command: 'pnpm',
      args: ['exec', 'vitest', 'run', '--reporter=dot'],
    },
  ],
  e2e: [
    {
      label: 'e2e',
      command: 'pnpm',
      args: ['exec', 'playwright', 'test', '--reporter=line'],
    },
  ],
  verify: [
    { label: 'repo', command: 'pnpm', args: ['check:repo'] },
    { label: 'lint', command: 'pnpm', args: ['lint'] },
    { label: 'check', command: 'pnpm', args: ['check'] },
    {
      label: 'unit',
      command: 'pnpm',
      args: ['exec', 'vitest', 'run', '--reporter=dot'],
    },
    { label: 'build', command: 'pnpm', args: ['build'] },
  ],
};

const name = process.argv[2];
const steps = name ? plans[name] : undefined;
if (!steps) {
  console.error(
    `usage: tsx scripts/run-quiet.ts ${Object.keys(plans).join('|')}`,
  );
  process.exit(1);
}

for (const step of steps) await run(step);
console.log(`ok ${name}`);

async function run(step: Step): Promise<void> {
  const output: string[] = [];
  const code = await new Promise<number | null>((resolve) => {
    const child = spawn(step.command, step.args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (data) => output.push(String(data)));
    child.stderr.on('data', (data) => output.push(String(data)));
    child.on('close', resolve);
  });
  if (code === 0) {
    console.log(`ok ${step.label}`);
    return;
  }
  console.error(`failed ${step.label}`);
  console.error(output.join(''));
  process.exit(code ?? 1);
}
