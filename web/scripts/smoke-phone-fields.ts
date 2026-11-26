import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { devices, type Page, webkit } from 'playwright-core';

const phone = devices['iPhone 13'];
const server = spawn(process.execPath, [
  fileURLToPath(new URL('./serve.ts', import.meta.url)),
  '--port=0',
  '--test-relay=ws://127.0.0.1:1',
]);

async function checkFields(page: Page, selector: string) {
  await page.locator(selector).first().waitFor();
  const fields = await page
    .locator('input, textarea, select, [contenteditable]')
    .evaluateAll((elements) =>
      elements.flatMap((el) => {
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
            label: el.getAttribute('aria-label') || el.className || el.tagName,
            size,
            rendered: size * Math.hypot(matrix.c, matrix.d, matrix.m32),
          },
        ];
      }),
    );
  assert.ok(fields.length, `No editable fields at ${selector}`);
  return fields.filter(({ size, rendered }) => !(size >= 16 && rendered >= 16));
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
  const failures: Awaited<ReturnType<typeof checkFields>> = [];
  const check = async (selector: string) => failures.push(...(await checkFields(page, selector)));

  await home.locator('.rtoggle')[press]();
  await check('.pdays input');
  await page.locator('.pane.min .zoom:not(.on)')[press]();
  const compose = page.locator('.view[data-kind="compose"]');
  await compose.getByRole('button', { name: 'Content warning' })[press]();
  await check('.ccw');
  await compose.getByRole('button', { name: 'Emoji', exact: true })[press]();
  await check('.epick input');
  await page.locator('.epick input')[press]();
  assert.ok(await page.locator('.epick input').evaluate((el) => el === document.activeElement));
  await page.locator('.epick input').blur();
  assert.equal(await page.evaluate(() => visualViewport?.scale), 1);
  await page.keyboard.press('Escape');

  const openSearch = async () => page.locator('.bar [data-tab-search]')[press]();
  await openSearch();
  await check('.tsearch input');
  const launch = async (query: string) => {
    await page.locator('.tsearch input').fill(query);
    await page.keyboard.press('Enter');
  };
  await launch('Settings');
  await check('.view[data-kind="settings"] select');

  await openSearch();
  await launch('Accounts');
  await page.locator('.view[data-kind="account"] .amore').first()[press]();
  await check('.view[data-kind="account"] input[type="password"]');

  await page.locator('.acct')[press]();
  await page.locator('.menu button').first()[press]();
  await page.getByRole('button', { name: 'Edit profile' })[press]();
  await check('.view[data-kind="profile-edit"] textarea');

  await page.locator('.pane.cur .strip').getByTitle('New tab', { exact: true })[press]();
  await check('.launcher input');
  return failures;
}

try {
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
          localStorage.setItem('lkjstr:mock', JSON.stringify({ live: false }));
          localStorage.setItem(
            'lkjstr:settings',
            JSON.stringify({ uiScale: 0.5, tabScale: 0.8, textSize: 11 }),
          );
        });
        const page = await context.newPage();
        page.setDefaultTimeout(8000);
        const small = await checkPhone(page, base, hasTouch ? 'tap' : 'click');
        assert.deepEqual(small, [], `Fields below 16px on iPhone WebKit (hasTouch=${hasTouch})`);
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
