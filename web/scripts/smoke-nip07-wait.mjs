// P2: real main-thread signer doubles with the production Worker and loopback relay.
import { writeFile } from 'node:fs/promises';
import { smokePath } from './smoke-output.ts';
import { accounts, code, setup } from './smoke-signer-support.mjs';

const home = '.view[data-kind="home"]';
const composer = '.view[data-kind="compose"]:visible';
const approve = 'Waiting for your extension. Approve there to send.';
const approveIn = 'Waiting for your extension. Approve there to sign in.';
const cancelled = 'Not sent. If your extension is still asking, dismiss it there.';
const cancelledIn = 'Sign-in stopped. If your extension is still asking, dismiss it there.';

export const nip07WaitNames = [
  'P2 fast sign-in and Post never flash wait words',
  'P2 warm Home, thread, profile and account face make zero signer calls',
  'P2 fast Post invokes signEvent once and never getPublicKey',
  'P2 late injection is named then signs in normally',
  'P2 slow Post offers Cancel in the composer and retained Home draft',
  'P2 cancelled Post keeps the draft and publishes no late signature',
  'P2 slow sign-in leaves other methods usable and drops the late answer',
  'P2 refused Post retains the existing refusal path',
  'P2 late injection is named then sends normally',
];

const trace = (page) => page.evaluate(() => window.signerTrace);
const calls = (page) => page.evaluate(() => ({ ...window.signerCalls }));
const openSignIn = async (page) => {
  await page.locator('.acct.out').click();
  await page.locator(`${accounts} [data-f="extension"]`).click();
};
const homeReady = (page) => page.locator(`${home} .note .text`).first().waitFor();
const post = async (page, content) => {
  const view = page.locator(composer);
  await view.locator('textarea').fill(content);
  await view.getByRole('button', { name: 'Post', exact: true }).click();
  return view;
};
const waitSent = (page) => page.locator(`${composer} .csend[data-phase="sent"]`).waitFor();

export async function fastNip07(options, baseline = false) {
  const page = await setup({ ...options, mode: 'p2-fast' });
  try {
    const coldReadCalls = await calls(page);
    await openSignIn(page);
    await homeReady(page);
    const discoveryCalls = await calls(page);
    const discoveryTrace = await trace(page);
    const t0 = performance.now();
    await page.reload();
    await homeReady(page);
    const homeMs = Math.round(performance.now() - t0);
    const navigationHomeMs = await page.evaluate(() => Math.round(performance.now()));
    await page.locator('.acct:not(.out) .av').waitFor();
    await page.locator(`${home} .note .text`).first().click();
    await page.locator('.th-focus').waitFor();
    await page.locator('.th-focus .name').first().click();
    await page.locator('.profile').waitFor();
    const readCalls = await calls(page);
    // The saved four-pane layout keeps the Post composer visible while reading.
    const samples = [];
    for (let n = 0; n < 5; n++) {
      const text = `P2 fast fixture ${n} ${Date.now()}`;
      const before = await calls(page);
      const offset = (await trace(page)).length;
      await post(page, text);
      await page.waitForFunction(
        (s) =>
          window.signerTrace.filter((t) => t.phase === 'publish-result' && t.value).length >= s,
        n + 1,
      );
      await waitSent(page);
      const after = await calls(page);
      const stages = (await trace(page))
        .slice(offset)
        .filter((t) =>
          [
            'publish-press',
            'publish-request',
            'sign-start',
            'sign-finish',
            'signed-answer',
            'publish-signed',
            'publish-result',
          ].includes(t.phase),
        );
      const start = stages.find((t) => t.phase === 'publish-press')?.at;
      const end = stages.find((t) => t.phase === 'publish-result')?.at;
      const uiMs = await page
        .locator(`${composer} .csend[data-phase="sent"]`)
        .getAttribute('data-ms');
      samples.push({
        before,
        after,
        stages,
        pressToAcceptedMs: end - start,
        uiSentMs: uiMs === null ? null : Number(uiMs),
      });
    }
    const finalTrace = await trace(page);
    const result = {
      baseline,
      coldReadCalls,
      discoveryCalls,
      discoveryTrace,
      homeMs,
      navigationHomeMs,
      readCalls,
      samples,
      finalTrace,
    };
    await writeFile(
      smokePath(baseline ? 'nip07-before.json' : 'nip07-after.json'),
      JSON.stringify(result, null, 2),
    );
    if (!baseline) {
      options.check(
        nip07WaitNames[0],
        ![...discoveryTrace, ...finalTrace].some((t) => t.phase === 'wait-words'),
      );
      options.check(
        nip07WaitNames[1],
        [...Object.values(coldReadCalls), ...Object.values(readCalls)].every((n) => n === 0),
      );
      options.check(
        nip07WaitNames[2],
        samples.every(
          ({ before, after }) =>
            after.signEvent - before.signEvent === 1 && after.getPublicKey === before.getPublicKey,
        ),
      );
    }
    return result;
  } finally {
    await page.context().close();
  }
}

async function lateNip07(options) {
  const page = await setup({ ...options, mode: 'p2-late' });
  try {
    await openSignIn(page);
    await homeReady(page);
    const events = await trace(page);
    const injected = events.find((t) => t.phase === 'injected');
    const looking = events.find((t) => t.phase === 'wait-words' && t.value.startsWith('Looking'));
    options.check(
      nip07WaitNames[3],
      !!looking && !!injected && looking.at < injected.at && (await calls(page)).getPublicKey === 1,
    );
    await writeFile(smokePath('nip07-late.json'), JSON.stringify(events, null, 2));
    await page.reload();
    const content = 'P2 late injection fixture note';
    await post(page, content);
    await waitSent(page);
    const sendEvents = await trace(page);
    const found = sendEvents.find((t) => t.phase === 'wait-words' && t.value.startsWith('Looking'));
    const appeared = sendEvents.find((t) => t.phase === 'injected');
    options.check(
      nip07WaitNames[8],
      !!found &&
        !!appeared &&
        found.at < appeared.at &&
        (await calls(page)).signEvent === 1 &&
        options.fake.published.some((e) => e.content === content),
    );
    await writeFile(smokePath('nip07-late-post.json'), JSON.stringify(sendEvents, null, 2));
  } finally {
    await page.context().close();
  }
}

async function slowPost(options) {
  const page = await setup({ ...options, mode: 'p2-slow-sign' });
  try {
    await openSignIn(page);
    await homeReady(page);
    const content = 'P2 cancelled fixture note';
    const view = await post(page, content);
    const draft = view.locator('.cdraft').filter({ hasText: content });
    const retained = page.locator(`${home} .home-draft`).filter({ hasText: content });
    await draft.getByText(approve, { exact: true }).waitFor();
    await retained.getByText(approve, { exact: true }).waitFor();
    options.check(
      nip07WaitNames[4],
      (await draft.getByRole('button', { name: 'Cancel', exact: true }).isEnabled()) &&
        (await retained.getByRole('button', { name: 'Cancel', exact: true }).isEnabled()),
    );
    await retained.getByRole('button', { name: 'Cancel', exact: true }).click();
    await code(page, 'cancelled');
    await draft.getByText(cancelled, { exact: true }).waitFor();
    await page.waitForFunction(
      () => window.signerTrace.some((t) => t.phase === 'sign-resolved'),
      null,
      { timeout: 25000 },
    );
    await page.waitForTimeout(300);
    // A real signature returned by the fixture was ignored, not sent to the Worker or the relay.
    const events = await trace(page);
    const kept =
      (await draft.innerText()).includes(content) &&
      (await draft.getByRole('button', { name: 'Retry', exact: true }).isEnabled()) &&
      (await draft.getByRole('button', { name: 'Edit', exact: true }).isEnabled()) &&
      (await draft.getByRole('button', { name: 'Remove', exact: true }).isEnabled());
    options.check(
      nip07WaitNames[5],
      kept &&
        !events.some(
          (t) =>
            t.phase === 'publish-signed' ||
            (t.phase === 'signed-answer' && t.value === 'signature'),
        ) &&
        !options.fake.published.some((e) => e.content === content),
    );
    await writeFile(smokePath('nip07-cancelled.json'), JSON.stringify(events, null, 2));
  } finally {
    await page.context().close();
  }
}
async function slowSignIn(options) {
  const page = await setup({ ...options, mode: 'p2-slow-discover' });
  try {
    await openSignIn(page);
    const view = page.locator(accounts);
    await view.getByText(approveIn, { exact: true }).waitFor();
    await view.locator('[data-f="other"]').click();
    const usable =
      (await view.locator('[data-f="create"]').isEnabled()) &&
      (await view.locator('input[type="password"]').isEnabled());
    await view.getByRole('button', { name: 'Cancel', exact: true }).click();
    await view.getByText(cancelledIn, { exact: true }).waitFor();
    await code(page, 'cancelled');
    await page.waitForFunction(
      () => window.signerTrace.some((t) => t.phase === 'discover-resolved'),
      null,
      { timeout: 25000 },
    );
    await page.waitForTimeout(300);
    const events = await trace(page);
    options.check(
      nip07WaitNames[6],
      usable &&
        (await view.locator('[data-f="extension"]').isEnabled()) &&
        (await page.locator('.acct.out').count()) === 1 &&
        !events.some((t) => t.phase === 'discovery-answer' && t.value === 'pubkey'),
    );
    await writeFile(smokePath('nip07-signin-cancelled.json'), JSON.stringify(events, null, 2));
  } finally {
    await page.context().close();
  }
}
async function refused(options) {
  const page = await setup({ ...options, mode: 'p2-refuse' });
  try {
    await openSignIn(page);
    await homeReady(page);
    const content = 'P2 refused fixture note';
    const view = await post(page, content);
    await code(page, 'signer-refused');
    const draft = view.locator('.cdraft').filter({ hasText: content });
    options.check(
      nip07WaitNames[7],
      (await draft.getByRole('button', { name: 'Retry', exact: true }).isEnabled()) &&
        !options.fake.published.some((e) => e.content === content),
    );
  } finally {
    await page.context().close();
  }
}
export async function nip07WaitChecks(options) {
  await fastNip07(options);
  await lateNip07(options);
  await Promise.all([slowPost(options), slowSignIn(options)]);
  await refused(options);
}
