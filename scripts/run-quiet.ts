import { spawn } from 'node:child_process';
import process from 'node:process';
import { appendBounded, OUTPUT_MAX_BYTES } from './run-quiet-buffer';

type Step = {
  readonly label: string;
  readonly command: string;
  readonly args: readonly string[];
};

const unitStep: Step = {
  label: 'unit',
  command: 'pnpm',
  args: ['exec', 'vitest', 'run', '--reporter=dot'],
};

const e2eStep: Step = {
  label: 'e2e',
  command: 'pnpm',
  args: ['exec', 'playwright', 'test', '--reporter=line'],
};

const verifySteps: readonly Step[] = [
  { label: 'repo', command: 'pnpm', args: ['check:repo'] },
  { label: 'lint', command: 'pnpm', args: ['lint'] },
  { label: 'check', command: 'pnpm', args: ['check'] },
  unitStep,
  { label: 'build', command: 'pnpm', args: ['build'] },
];

const plans: Record<string, readonly Step[]> = {
  test: [unitStep],
  e2e: [e2eStep],
  verify: verifySteps,
  ci: [...verifySteps, e2eStep],
  cloudflare: [
    { label: 'cloudflare', command: 'pnpm', args: ['cloudflare:dry-run'] },
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

for (const step of steps) await runStep(step);
console.log(`ok ${name}`);

async function runStep(step: Step): Promise<void> {
  let output = '';
  const push = (data: Buffer): void => {
    output = appendBounded(output, String(data), OUTPUT_MAX_BYTES);
  };

  const result = await new Promise<
    | { readonly ok: true }
    | {
        readonly ok: false;
        readonly code: number | null;
        readonly signal: NodeJS.Signals | null;
        readonly error?: unknown;
      }
  >((resolve) => {
    const child = spawn(step.command, [...step.args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.on('error', (error) =>
      resolve({ ok: false, code: null, signal: null, error }),
    );
    child.stdout?.on('data', push);
    child.stderr?.on('data', push);
    child.on('close', (code, signal) => {
      if (code === 0 && !signal) resolve({ ok: true });
      else resolve({ ok: false, code, signal });
    });
  });

  if (result.ok) return;
  reportFailure(step.label, output, result);
}

function reportFailure(
  label: string,
  output: string,
  result: {
    readonly code: number | null;
    readonly signal: NodeJS.Signals | null;
    readonly error?: unknown;
  },
): never {
  console.error(`failed ${label}`);
  if (result.error) console.error(String(result.error));
  else if (result.signal) console.error(`signal ${result.signal}`);
  else console.error(`exit ${result.code ?? 'unknown'}`);
  if (output) console.error(output);
  const code =
    typeof result.code === 'number' && result.code !== 0
      ? result.code
      : result.signal
        ? 1
        : 1;
  process.exit(code);
}
