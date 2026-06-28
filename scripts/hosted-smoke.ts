import { runHostedSmoke } from './hosted-smoke-core';

const origin =
  process.argv.slice(2).find((arg) => arg !== '--') ??
  process.env.LKJSTR_HOSTED_ORIGIN;

if (!origin) {
  console.error('usage: tsx scripts/hosted-smoke.ts https://example.com');
  process.exit(1);
}

await runHostedSmoke({ origin });
console.log(`ok hosted-smoke ${new URL(origin).origin}`);
