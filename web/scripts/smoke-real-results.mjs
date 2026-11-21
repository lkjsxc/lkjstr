import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { smokePath } from './smoke-output.ts';

export function createSmokeResults() {
  const checks = {};
  const failures = [];
  const progress = smokePath('smoke-real-progress.log');
  const report = smokePath('smoke-real/report.json');
  mkdirSync(dirname(progress), { recursive: true });
  writeFileSync(progress, '');

  function record(name, ok) {
    checks[name] = ok ? 'ok' : 'FAIL';
    appendFileSync(progress, `${checks[name]} ${name}\n`);
    if (ok) return;
    const error = new Error(name);
    failures.push({ name, error });
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

  const failureDetails = () =>
    failures.map(({ name, error }) => ({ name, error: String(error), stack: error?.stack }));
  return {
    check(name, ok = true) {
      const error = record(name, ok);
      if (error) throw error;
    },
    async observe(name, ok, page) {
      const error = record(name, ok);
      if (error) await captureDom(page, `smoke-real-observation-${failures.length}.txt`);
    },
    async fail(error, page) {
      checks.failure = String(error);
      const last = failures.at(-1);
      if (!last || last.error !== error) failures.push({ name: 'failure', error });
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
            failures: failureDetails(),
          },
          null,
          2,
        ),
      );
    },
    finish(errors) {
      if (failures.length) {
        console.error(JSON.stringify({ checks, errors, failures: failureDetails() }));
        process.exitCode = 1;
      } else console.log('ok smoke-real');
    },
  };
}
