// Drive the shipped channel and statistics views against the loopback relay only.
export async function channelScenarios({ page, launch, check, fake, shots, shot }) {
  const room = '.pane.cur .view[data-kind="channel"]:visible';
  const post = async (text) => {
    await page.locator(`${room} textarea`).fill(text);
    await page.locator(`${room} .csay`).getByRole('button', { name: 'Post', exact: true }).click();
    await page.locator(`${room} .note`).filter({ hasText: text }).waitFor();
    for (let n = 0; n < 200 && !fake.published.some((e) => e.content === text); n++)
      await page.waitForTimeout(25);
    return fake.published.find((e) => e.content === text);
  };
  await launch('Channels', 'channels');
  await page.locator('.chans [data-f="create"]').click();
  const name = `Smoke channel ${Date.now()}`;
  await page.locator('.cform [data-f="name"]').fill(name);
  await page.locator('.cform').getByRole('button', { name: 'Save', exact: true }).click();
  await page.locator(`${room} .pname`).filter({ hasText: name }).waitFor();
  const channelTab = await page.locator('.pane.cur .tab.active').getAttribute('data-view');
  const creation = fake.published.find((e) => e.kind === 40 && JSON.parse(e.content).name === name);
  check(
    'Channels creates and opens a joined own channel',
    !!creation &&
      (await page.locator(`${room} [data-f="edit"]`).isVisible()) &&
      (await page.locator(`${room} [data-f="join"]`).getAttribute('aria-pressed')) === 'true',
  );
  const text = `Channel UI publication ${Date.now()}`;
  const message = await post(text);
  check(
    'channel composer signs kind 42 root and client tag',
    message?.kind === 42 &&
      message.tags.some((t) => t[0] === 'e' && t[1] === creation.id && t[3] === 'root') &&
      message.tags.some((t) => t[0] === 'client' && t[1] === 'lkjstr'),
  );
  await page.locator(`${room} [data-f="edit"]`).click();
  await page.locator('.cform [data-f="name"]').fill(`${name} edited`);
  await page.locator('.cform').getByRole('button', { name: 'Save', exact: true }).click();
  await page
    .locator(`${room} .pname`)
    .filter({ hasText: `${name} edited` })
    .waitFor();
  check(
    'channel edit updates its real-engine header',
    fake.published.some((e) => e.kind === 41 && e.tags.some((t) => t[1] === creation.id)),
  );
  await page.locator(`${room} [data-f="join"]`).click();
  await page.locator(`${room} [data-f="join"][aria-pressed="false"]`).waitFor();
  await page.locator(`${room} [data-f="join"]`).click();
  await page.locator(`${room} [data-f="join"][aria-pressed="true"]`).waitFor();
  check('channel leave and join patch the visible header');
  await page.locator('.pane.cur .tab[data-view^="channels"]').click();
  await page
    .locator('.chans .chan')
    .filter({ hasText: `${name} edited` })
    .click();
  await page.locator(`${room} .note`).filter({ hasText: text }).waitFor();
  check('Channels list opens the published channel feed');
  await page.locator(`${room} .note`).filter({ hasText: text }).locator('.text').click();
  await page.locator('.th-focus .a-reply').click();
  const replyText = `Channel UI thread reply ${Date.now()}`;
  const composer = page.locator('.pane.cur .view[data-kind="compose"]:visible');
  await composer.locator('textarea').fill(replyText);
  await composer.getByRole('button', { name: 'Reply', exact: true }).click();
  await composer.locator('.cresult', { hasText: 'Delivered' }).waitFor();
  const reply = fake.published.find((e) => e.content === replyText);
  check(
    'Thread reply inherits the channel through the real engine',
    reply?.kind === 42 &&
      reply.tags.some((t) => t[0] === 'e' && t[1] === creation.id && t[3] === 'root') &&
      reply.tags.some((t) => t[0] === 'e' && t[1] === message.id && t[3] === 'reply'),
  );
  await launch('Settings', 'settings');
  await page.getByRole('checkbox', { name: 'via lkjstr', exact: true }).uncheck();
  await page.locator('.pane.cur .tab.active > .x').click();
  await page.locator(`.pane.cur .tab[data-view="${channelTab}"]`).click();
  const untagged = await post(`Channel without client tag ${Date.now()}`);
  check(
    'client-tag switch reaches the real channel signer',
    untagged?.kind === 42 && !untagged.tags.some((t) => t[0] === 'client'),
  );
  await launch('Settings', 'settings');
  await page.getByRole('checkbox', { name: 'via lkjstr', exact: true }).check();
  await page.locator('.pane.cur .tab.active > .x').click();
  await launch('Stats', 'stats');
  await page.locator('.statsv .stab:visible tbody tr').first().waitFor();
  check(
    'Stats shows five real figures and loopback relay measurements',
    (await page.locator('.statsv .sval').count()) === 5 &&
      (await page.locator('.statsv .sval').last().innerText()) !== '—' &&
      (await page.locator('.statsv .c-events span').first().innerText()) !== '0',
  );
  if (shots) {
    // Capture the real Stats view in a single-tile workspace at both widths.
    await page.locator('lkjstr-spaces button').nth(1).click();
    await launch('Stats', 'stats');
    await page.locator('.statsv .stab:visible tbody tr').first().waitFor();
    const viewport = page.viewportSize();
    const dark = await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches);
    await page.emulateMedia({ colorScheme: 'dark' });
    const theme = await page.evaluate(() => {
      const old = document.documentElement.dataset.theme;
      document.documentElement.dataset.theme = 'dark';
      return old;
    });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.locator('.statsv .stab:visible tbody tr').first().waitFor();
      await shot(page, `orchestration-stats-${width}-dark.png`);
    }
    if (viewport) await page.setViewportSize(viewport);
    await page.emulateMedia({ colorScheme: dark ? 'dark' : 'light' });
    await page.evaluate((old) => {
      if (old) document.documentElement.dataset.theme = old;
      else delete document.documentElement.dataset.theme;
    }, theme);
    await page.locator('lkjstr-spaces button').first().click();
  }
}
