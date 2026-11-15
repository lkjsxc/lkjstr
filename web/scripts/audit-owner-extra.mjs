// Reading continuity, channel discovery and pointer panning. No changes to the rail implementation.
export async function auditExtra({ page, find, fact, view, real, width }) {
  await find('Global', 'global');
  const feed = view('global');
  await feed.locator('.note').first().waitFor();
  await feed.evaluate((e) => {
    e.scrollTop = 0;
  });
  const initial = await feed.locator('.note').first().getAttribute('data-key');
  let distance = 0;
  for (let n = 0; n < 22; n++) {
    await feed.evaluate((e) => {
      e.scrollTop = e.scrollHeight - e.clientHeight - 2;
    });
    await page.waitForTimeout(200);
    distance = await feed.evaluate((e) => e.scrollTop);
  }
  const retained = (await feed.locator('.note').first().getAttribute('data-key')) === initial;
  await feed.evaluate((e) => {
    e.scrollTop = 0;
  });
  await page.waitForTimeout(200);
  await fact(
    27,
    'read-history-retained',
    distance > 5000 &&
      retained &&
      (await feed.locator('.note').first().getAttribute('data-key')) === initial &&
      (await feed.evaluate((e) => e.scrollTop)) === 0,
  );
  if (real) {
    await find('Search', 'search');
    const search = view('search');
    await search.locator('.rbar input').fill('Engine fixture');
    await search.locator('.rbar input').press('Enter');
  }
  const media = page.locator('.view:visible .mbox').first();
  await media.scrollIntoViewIfNeeded();
  await media.click();
  const image = page.locator('.mstage img');
  await image.waitFor();
  await image.evaluate((e) => e.decode());
  const stage = page.locator('.mstage');
  const box = await stage.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -1000);
  await page.waitForTimeout(100);
  const before = await image.getAttribute('style');
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 60, { steps: 8 });
  await page.mouse.up();
  await fact(31, 'image-drag', (await image.getAttribute('style')) !== before);
  await find('Channels', 'channels');
  const channels = view('channels');
  await channels.locator('.chan').first().waitFor();
  const name = await channels.locator('.chan .name').first().innerText();
  await channels.locator('input[type="search"]').fill(name);
  await page.waitForTimeout(300);
  await channels.locator('.chan').first().click();
  await view('channel').locator('.note').first().waitFor();
  const room = view('channel');
  const text = `local owner audit channel message ${width}`;
  await room.locator('textarea').fill(text);
  await room.locator('.csay').getByRole('button', { name: 'Post', exact: true }).click();
  await room.locator('.note').filter({ hasText: text }).waitFor();
  await fact(15, 'channels-find-read-post', (await room.locator('textarea').inputValue()) === '');
}
