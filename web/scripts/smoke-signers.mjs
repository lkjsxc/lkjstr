// NIP-07 rejection/deadlines and NIP-46 sessions through the shipped UI.

import { writeFile } from 'node:fs/promises';
import { remote } from './smoke-bunker.mjs';
import { smokePath } from './smoke-output.ts';
import { accounts, code, compose, launch, setup, signerFace } from './smoke-signer-support.mjs';

async function failure(options, mode) {
  const { check, fake } = options;
  const page = await setup({ ...options, mode });
  const start = fake.published.length;
  let draft = `keep draft ${mode}`;
  try {
    await page.locator('.acct.out').click();
    await page.locator(`${accounts} [data-f="extension"]`).click();
    if (mode.endsWith('sign')) {
      await page.locator('.acct:not(.out)').waitFor();
      await launch(page, 'Post', 'compose');
      await signerFace(page, `NIP-07 ${mode} sign-in`, check);
      await page.locator(`${compose} textarea`).fill(draft);
      await page.locator(compose).getByRole('button', { name: 'Post', exact: true }).click();
      check(
        `wish-3 NIP-07 ${mode} frees the input before signing`,
        (await page.locator(`${compose} textarea`).inputValue()) === '' &&
          (await page
            .locator(`${compose} textarea`)
            .evaluate((el) => el === document.activeElement)),
      );
      await page.locator(`${compose} textarea`).fill('next note while signer waits');
      await page.waitForFunction(() => window.signerCalls.signEvent === 1);
    } else await page.waitForFunction(() => window.signerCalls.getPublicKey === 1);
    // A pending extension promise must not lock navigation or ordinary input.
    await launch(page, 'Search', 'search');
    await page.locator('.pane.cur .view[data-kind="search"] input').first().fill('still usable');
    check(`NIP-07 ${mode} leaves navigation and input usable`);
    const expected = mode.startsWith('reject')
      ? 'signer-refused'
      : mode === 'hang-sign'
        ? 'signer-timeout'
        : 'signer-missing';
    await code(page, expected);
    check(`NIP-07 ${mode} returns the expected failure code`);
    check(`NIP-07 ${mode} publishes nothing`, fake.published.length === start);
    if (mode.endsWith('sign')) {
      await page.locator('.pane.cur .tab[data-view^="compose"]').last().click();
      check(
        `NIP-07 ${mode} preserves draft and permits retry`,
        (await page.locator(`${compose} .outbox`).innerText()).includes(draft) &&
          (await page.locator(`${compose} textarea`).inputValue()) ===
            'next note while signer waits' &&
          (await page
            .locator(compose)
            .getByRole('button', { name: 'Retry', exact: true })
            .isEnabled()),
      );
      if (mode === 'reject-sign') {
        // Deterministically reload inside the 300 ms draft debounce window.
        const clockStart = new Date('2026-11-15T12:00:00Z');
        await page.clock.install({ time: clockStart });
        await page.clock.pauseAt(new Date(clockStart.getTime() + 1000));
        draft = 'next note while signer waits latest edit';
        await page.locator(`${compose} textarea`).fill(draft);
      }
      if (mode !== 'reject-sign') draft = 'next note while signer waits';
      const saved = await page.evaluate(
        (draft) =>
          Object.entries(localStorage).some(
            ([k, v]) => k.startsWith('lkjstr:view:') && v.includes(draft),
          ),
        draft,
      );
      await page.reload();
      if (mode === 'reject-sign') await page.clock.resume();
      await page.locator(`${compose} textarea`).waitFor();
      await signerFace(page, `NIP-07 ${mode} reload`, check);
      const restored =
        (await page.locator(`${compose} .cdraft`).innerText()).includes(`keep draft ${mode}`) &&
        (await page
          .locator(compose)
          .getByRole('button', { name: 'Retry', exact: true })
          .isEnabled()) &&
        (await page.locator(`${compose} textarea`).inputValue()) === draft;
      await writeFile(
        smokePath(`signer-${mode}.json`),
        JSON.stringify({
          saved,
          restored,
        }),
      );
      check(`NIP-07 ${mode} preserves draft across reload`, saved && restored);
    } else
      check(`NIP-07 ${mode} creates no account`, (await page.locator('.acct.out').count()) === 1);
  } finally {
    await page.context().close();
  }
}
export async function signerScenarios(options) {
  const check = (...args) => {
    try {
      options.check(...args);
    } catch {
      /* retain failed gate, continue independent scenarios */
    }
  };
  const run = async (name, task) => {
    try {
      await task();
    } catch (error) {
      // Locator failures contain no action/key payloads; expose only their type.
      check(`${name} completed (${error.name}: ${error.message.split('\n')[0]})`, false);
    }
  };
  const scenario = { ...options, check };
  // At most four browser scenarios at once; no public relay or production data.
  await Promise.all(
    ['reject-discover', 'hang-discover', 'reject-sign', 'hang-sign'].map((mode) =>
      run(mode, () => failure(scenario, mode)),
    ),
  );
  for (const secret of [false, true]) await run(`NIP-46 ${secret}`, () => remote(scenario, secret));
}
