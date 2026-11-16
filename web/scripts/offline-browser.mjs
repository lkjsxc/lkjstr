// Browser profiles and artifacts stay inside this checkout and are removed after every run.
import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

export async function shellBrowser() {
  const root = fileURLToPath(new URL('../../tmp/', import.meta.url));
  await mkdir(root, { recursive: true });
  const scratch = await mkdtemp(join(root, 'sw-'));
  const previousTmp = process.env.TMPDIR;
  let browser;
  try {
    const cache = `${process.env.HOME}/.cache/ms-playwright`;
    const chrome =
      process.env.LKJSTR_CHROME ??
      `${cache}/${(await readdir(cache))
        .filter((s) => s.startsWith('chromium-'))
        .sort()
        .pop()}/chrome-linux64/chrome`;
    // These test processes launch browsers sequentially. Playwright uses Node's tmpdir at launch.
    process.env.TMPDIR = scratch;
    browser = await chromium.launch({
      executablePath: chrome,
      args: ['--no-sandbox', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'],
    });
  } catch (error) {
    await rm(scratch, { recursive: true, force: true });
    throw error;
  } finally {
    if (previousTmp === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = previousTmp;
  }
  return {
    newContext: () => browser.newContext(),
    async close() {
      try {
        await browser.close();
      } finally {
        await rm(scratch, { recursive: true, force: true });
      }
    },
  };
}
