import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { smokePath } from './smoke-output.ts';

export function createSmokeResults() {
  const checks = {};
  const failures = [];
  const progress = smokePath('smoke-real-progress.log');
  const failureLog = smokePath('smoke-real-failures.jsonl');
  const report = smokePath('smoke-real/report.json');
  let lastError;
  mkdirSync(dirname(progress), { recursive: true });
  writeFileSync(progress, '');
  writeFileSync(failureLog, '');

  function recordFailure(name, error) {
    const failure = { name, error: String(error), stack: error?.stack ?? null };
    appendFileSync(failureLog, `${JSON.stringify(failure)}\n`);
    failures.push(failure);
    lastError = error;
  }

  function record(name, ok) {
    checks[name] = ok ? 'ok' : 'FAIL';
    appendFileSync(progress, `${checks[name]} ${name}\n`);
    if (ok) return;
    const error = new Error(name);
    recordFailure(name, error);
    return error;
  }

  async function captureDom(page, file) {
    if (!page) return;
    try {
      await writeFile(smokePath(file), await page.locator('body').innerText({ timeout: 2000 }));
    } catch (error) {
      console.error(`Could not capture ${file}: ${error}`);
    }
  }

  return {
    check(name, ok = true) {
      const error = record(name, ok);
      if (error) throw error;
    },
    async observe(observations, page) {
      const captures = [];
      for (const [name, ok] of observations) {
        if (record(name, ok)) captures.push(`smoke-real-observation-${failures.length}.txt`);
      }
      for (const file of captures) await captureDom(page, file);
    },
    async fail(error, page) {
      checks.failure = String(error);
      if (!failures.length || lastError !== error) recordFailure('failure', error);
      await captureDom(page, 'smoke-real-dom.txt');
    },
    async writeReport(errors, fake) {
      await mkdir(dirname(report), { recursive: true });
      await writeFile(
        report,
        JSON.stringify(
          {
            checks,
            errors,
            publications: fake.published.map((e) => ({ id: e.id, kind: e.kind })),
            searches: fake.searches,
            failures,
          },
          null,
          2,
        ),
      );
    },
    finish(errors) {
      if (failures.length) {
        console.error(JSON.stringify({ checks, errors, failures }));
        process.exitCode = 1;
      } else console.log('ok smoke-real');
    },
  };
}
