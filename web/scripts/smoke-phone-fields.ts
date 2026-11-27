import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { devices, type Page, webkit } from 'playwright-core';
import { checkKeyboardRecovery } from './smoke-phone-keyboard.ts';

const phone = devices['iPhone 13'];
const shots = process.env.LKJSTR_PHONE_SHOTS;
const FIELD = 'input, textarea, select, [contenteditable]';
const observations: unknown[] = [];
const server = spawn(process.execPath, [
  fileURLToPath(new URL('./serve.ts', import.meta.url)),
  '--port=0',
  '--test-relay=ws://127.0.0.1:1',
]);

async function checkFields(page: Page, selector: string, press: 'tap' | 'click', scene: string) {
  const controls = page.locator(selector);
  await controls.filter({ visible: true }).first().waitFor();
  const fields = await controls.evaluateAll((elements) =>
    elements.flatMap((el, index) => {
      if (
        !(el instanceof HTMLElement) ||
        !el.checkVisibility({ checkVisibilityCSS: true }) ||
        el.closest('[inert]') ||
        el.matches(':disabled, [readonly]')
      )
        return [];
      if (
        el instanceof HTMLInputElement &&
        [
          'button',
          'checkbox',
          'color',
          'file',
          'hidden',
          'image',
          'radio',
          'range',
          'reset',
          'submit',
        ].includes(el.type)
      )
        return [];
      if (el.hasAttribute('contenteditable') && !el.isContentEditable) return [];

      const size = Number.parseFloat(getComputedStyle(el).fontSize);
      let matrix = new DOMMatrix();
      for (let node: HTMLElement | null = el; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        const zoom = Number.parseFloat(style.zoom) || 1;
        const transform = new DOMMatrix(style.transform === 'none' ? undefined : style.transform);
        matrix = transform.scale(zoom).multiply(matrix);
      }
      return [
        {
          label: el.getAttribute('aria-label') || el.dataset.f || el.className || el.tagName,
          index,
          select: el instanceof HTMLSelectElement,
          size,
          rendered: size * Math.hypot(matrix.c, matrix.d, matrix.m32),
        },
      ];
    }),
  );
  assert.ok(fields.length, `No editable fields at ${selector}`);
  assert.deepEqual(
    fields.filter(({ size, rendered }) => !(size >= 16 && rendered >= 16)),
    [],
    `Fields below 16px at ${scene} (${press})`,
  );
  const scale = () =>
    page.evaluate(
      () => new Promise((read) => requestAnimationFrame(() => read(visualViewport?.scale))),
    );
  const shot = (phase: string) =>
    shots && press === 'tap'
      ? page.screenshot({ path: join(shots, `${scene}-${phase}.png`), animations: 'disabled' })
      : undefined;
  let captured = false;
  for (const { index, label, select, size, rendered } of fields) {
    if (select) continue; // Native select pickers have no text entry or keyboard.
    const field = controls.nth(index);
    assert.equal(await scale(), 1, `Before focusing ${label}`);
    await field[press]();
    assert.ok(await field.evaluate((el) => el === document.activeElement), `Focus on ${label}`);
    const focused = await scale();
    assert.equal(focused, 1, `While focused on ${label}`);
    if (!captured) await shot('focus');
    await field.blur();
    const blurred = await scale();
    assert.equal(blurred, 1, `After blurring ${label}`);
    if (shots) observations.push({ scene, press, label, size, rendered, focused, blurred });
    if (!captured) await shot('blur');
    captured = true;
  }
}

async function checkPhone(page: Page, base: string, press: 'click' | 'tap') {
  await page.goto(base);
  const home = page.locator('.view[data-kind="home"]');
  await home.locator('.note').first().waitFor();
  assert.equal(await page.evaluate(() => visualViewport?.scale), 1);
  assert.equal(await page.evaluate(() => innerWidth), phone.viewport.width);
  assert.equal(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), press === 'tap');
  assert.doesNotMatch(
    (await page.locator('meta[name="viewport"]').getAttribute('content')) ?? '',
    /user-scalable|maximum-scale/i,
  );
  const check = (scene: string, scope: string) =>
    checkFields(page, `${scope} :is(${FIELD})`, press, scene);

  await home.locator('.rtoggle')[press]();
  await page.locator('.pdays input').first().waitFor();
  await check('home-filter', '.view[data-kind="home"]');
  await home.locator('.note .acts > .a-reply:not(.off)').first()[press]();
  const thread = '.view[data-kind="thread"]';
  await page.locator(`${thread} .tsay textarea`).waitFor();
  await check('reply', `${thread} .tsay`);

  await page.locator('.pane.min .zoom:not(.on)')[press]();
  const compose = page.locator('.view[data-kind="compose"]');
  await compose.getByRole('button', { name: 'Content warning' })[press]();
  await check('compose', '.view[data-kind="compose"]');
  await compose.getByRole('button', { name: 'Emoji', exact: true })[press]();
  await check('emoji-search', '.epick');
  await page.keyboard.press('Escape');

  const openSearch = async () => page.locator('.bar [data-tab-search]')[press]();
  await openSearch();
  await check('tab-search', '.tsearch');
  const launch = async (query: string) => {
    await page.locator('.tsearch input').fill(query);
    await page.keyboard.press('Enter');
  };
  await launch('Search');
  await check('search', '.view[data-kind="search"]');
  await openSearch();
  await launch('Settings');
  const settings = '.view[data-kind="settings"]';
  await check('settings', settings);
  await check('relay-url', `${settings} [data-entry="set.relayList"]`);

  await openSearch();
  await launch('Accounts');
  await page.locator('.view[data-kind="account"] .amore').first()[press]();
  await page.locator('.view[data-kind="account"] input[type="password"]').first().waitFor();
  await check('accounts', '.view[data-kind="account"]');

  await page.locator('.acct')[press]();
  await page.locator('.menu button').first()[press]();
  await page.getByRole('button', { name: 'Edit profile' })[press]();
  await page.locator('.view[data-kind="profile-edit"] textarea:enabled').waitFor();
  await check('profile-edit', '.view[data-kind="profile-edit"]');

  await page.locator('.pane.cur .strip').getByTitle('New tab', { exact: true })[press]();
  await check('launcher', '.launcher');
}

try {
  if (shots) await mkdir(shots, { recursive: true });
  const [address] = await Promise.race([
    once(server.stdout, 'data'),
    once(server, 'exit').then(([code]) => {
      throw new Error(`Server exited ${code}`);
    }),
  ]);
  const base = String(address).trim();
  const browser = await webkit.launch();
  try {
    for (const hasTouch of [true, false]) {
      // A narrow Safari window must keep the floor even when a fine pointer is primary.
      const context = await browser.newContext({ ...phone, hasTouch, locale: 'en-US' });
      try {
        await context.route('**/*', (route) =>
          route.request().url().startsWith(`${base}/`) ? route.continue() : route.abort(),
        );
        await context.routeWebSocket('**/*', (socket) => socket.close());
        await context.addInitScript(() => {
          localStorage.setItem('lkjstr:mock', JSON.stringify({ live: false, threads: true }));
          localStorage.setItem(
            'lkjstr:settings',
            JSON.stringify({ uiScale: 0.5, tabScale: 0.8, textSize: 11 }),
          );
        });
        const page = await context.newPage();
        page.setDefaultTimeout(8000);
        await checkPhone(page, base, hasTouch ? 'tap' : 'click');
        if (shots) {
          await writeFile(join(shots, 'fields.json'), `${JSON.stringify(observations, null, 2)}\n`);
        }
        if (hasTouch) await checkKeyboardRecovery(page);
      } finally {
        await context.close();
      }
    }
    console.log('ok smoke phone fields (WebKit iPhone 13)');
  } finally {
    await browser.close();
  }
} finally {
  if (server.exitCode === null) {
    server.kill();
    await once(server, 'exit');
  }
}
