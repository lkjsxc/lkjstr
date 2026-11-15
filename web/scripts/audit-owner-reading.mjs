export async function auditReading({ page, find, fact, view, peopleToken, message }) {
  await find('Global', 'global');
  const global = view('global');
  await global.locator('.note').first().waitFor();
  await global.evaluate((e) => {
    e.scrollTop = 0;
  });
  await global.locator('.rtoggle').click();
  await fact(
    14,
    'query-syntax',
    (await global.locator('.rbar input').getAttribute('placeholder')).includes('from:') &&
      (await global.locator('.rbar input').getAttribute('title')).includes('"'),
  );
  await global.locator('.rbar input').fill(`"${message}" -Continuity`);
  await global.locator('.note').filter({ hasText: message }).waitFor();
  await page.waitForFunction(
    () => document.querySelectorAll('.view[data-kind="global"] .note').length === 1,
  );
  await fact(14, 'query-works', (await global.locator('.note').count()) === 1);
  await global.locator('.rclear').click();
  await global.locator('.rtoggle').click();
  await global.getByLabel('From', { exact: true }).fill('2023/01/01');
  await global.getByLabel('From', { exact: true }).press('Tab');
  await global.getByLabel('To', { exact: true }).fill('2027/01/01');
  await global.getByLabel('To', { exact: true }).press('Tab');
  await fact(4, 'two-days', (await global.locator('.pdays input').count()) === 2);
  await global.getByLabel('From', { exact: true }).fill('2030/01/01');
  await global.getByLabel('From', { exact: true }).press('Tab');
  await global.getByLabel('To', { exact: true }).fill('2031/01/01');
  await global.getByLabel('To', { exact: true }).press('Tab');
  await page.waitForFunction(() => !document.querySelector('.view[data-kind="global"] .note'));
  await fact(4, 'period-narrows', (await global.locator('.note').count()) === 0);
  await global.getByLabel('From', { exact: true }).fill('2023/01/01');
  await global.getByLabel('From', { exact: true }).press('Tab');
  await global.getByLabel('To', { exact: true }).fill('2027/01/01');
  await global.getByLabel('To', { exact: true }).press('Tab');
  await global.locator('.note').first().waitFor();

  await global.locator('.padd').fill(peopleToken);
  await global.locator('.padd').press('Enter');
  await global.locator('.note').filter({ hasText: message }).waitFor();
  await fact(18, 'people-allow-list', (await global.locator('.ppeople .chip').count()) === 1);
  await global.locator('.rclear').click();
  await global.locator('.rtoggle').click();
  await global
    .locator('.rpanel .prow')
    .last()
    .getByRole('button', { name: 'Show', exact: true })
    .click();
  await global.locator('.notif').first().waitFor();
  await fact(
    34,
    'timeline-notifications',
    (await global
      .locator('.rpanel .prow')
      .last()
      .getByRole('button', { name: 'Show', exact: true })
      .getAttribute('aria-pressed')) === 'true',
  );
  await global.locator('.rclear').click();
  await global.locator('.note').first().waitFor();
  const first = global.locator('.note').first();
  const actions = await first
    .locator('.acts > button')
    .evaluateAll((es) =>
      es
        .filter((e) => e.getBoundingClientRect().width)
        .map((e) => ({ name: e.className, y: e.getBoundingClientRect().y })),
    );
  await fact(
    12,
    'action-order',
    /reply/.test(actions[0]?.name) &&
      /repost/.test(actions[1]?.name) &&
      /heart/.test(actions[2]?.name) &&
      actions.every((a) => Math.abs(a.y - actions[0].y) < 2),
  );
  await fact(
    36,
    'full-width',
    await first.evaluate(
      (e) => Math.abs(e.getBoundingClientRect().width - e.closest('.view').clientWidth) < 32,
    ),
  );
  await global.evaluate((e) => {
    e.scrollTop = 500;
  });
  await fact(
    22,
    'filter-scrolls',
    await global.evaluate(
      (e) =>
        e.querySelector('.fbar').getBoundingClientRect().bottom < e.getBoundingClientRect().top,
    ),
  );
  await global.evaluate((e) => {
    e.scrollTop = 0;
  });
  await first.locator('.avb').click();
  await view('profile').locator('.profile').waitFor();
  await fact(24, 'avatar-profile', await view('profile').locator('.profile').isVisible());
  const kinds = view('profile').locator('.pkind');
  await fact(
    26,
    'profile-kinds',
    (await kinds.allTextContents()).join(',') === 'Posts,Replies,Reposts,Reactions,Media',
  );
  for (const name of ['Replies', 'Reposts', 'Reactions', 'Media', 'Posts']) {
    await view('profile').getByRole('tab', { name, exact: true }).click();
    await page.waitForTimeout(150);
  }
  await page.locator('.acct').click();
  await fact(
    17,
    'account-menu',
    !(await page.locator('.menu').innerText()).includes('Shortcuts') &&
      !(await page.locator('.menu').innerText()).includes('Settings'),
  );
  await page.locator('.menu button').first().click();
  await view('profile').locator('.profile').waitFor();
  await fact(8, 'own-profile', await view('profile').locator('.profile').isVisible());
  await find('Notifications', 'notifications');
  const news = view('notifications');
  await news.locator('.ntypes').waitFor();
  await news.locator('.notif').first().waitFor();
  await fact(
    2,
    'notification-inside',
    await news.evaluate((e) => {
      const bar = e.querySelector('.ntypes');
      return bar && getComputedStyle(bar).position !== 'fixed' && e.contains(bar);
    }),
  );
  await news.evaluate((e) => {
    e.scrollTop = 500;
  });
  await fact(
    23,
    'notification-scrolls',
    await news.evaluate(
      (e) =>
        e.querySelector('.ntypes').getBoundingClientRect().bottom < e.getBoundingClientRect().top,
    ),
  );
  await news.evaluate((e) => {
    e.scrollTop = 0;
  });
  const notice = news.locator('.notif').first();
  if (await notice.count()) {
    const b = await notice.boundingBox();
    // Keep the blank-margin press clear of the tile divider's extended pointer target.
    await notice.click({ position: { x: 8, y: b.height - 4 } });
    await fact(25, 'notification-margin', await view('thread').isVisible());
  } else await fact(25, 'notification-margin', false);
}
