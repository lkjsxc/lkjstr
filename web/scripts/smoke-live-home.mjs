// Signed loopback events exercise the production render path after warm Home replay.
export async function checkLiveHome({
  page,
  fake,
  check,
  sign,
  arrival,
  delivered,
  disconnect,
  shot,
  overflow,
}) {
  const home = '.view[data-kind="home"]';
  const view = page.locator(home);
  const pill = view.locator('.fresh');
  const named = () =>
    view
      .locator('.list > .note .name', { hasText: /^Cache fixture$/ })
      .first()
      .waitFor();
  const head = async (...ids) => {
    await page.waitForFunction(
      ({ home, ids }) => {
        const notes = document.querySelectorAll(`${home} .list > .note`);
        return ids.every((id, i) => notes[i]?.getAttribute('data-note') === id);
      },
      { home, ids },
    );
  };
  const readingPlace = () =>
    view.evaluate((el) => {
      const top = el.getBoundingClientRect().top;
      const row = [...el.querySelectorAll('.list > .note')].find(
        (node) => node.getBoundingClientRect().bottom > top + 1,
      );
      return { id: row.dataset.note, offset: row.getBoundingClientRect().top - top };
    });
  const scroll = async (top) => {
    await view.evaluate((node, top) => {
      node.scrollTop = top;
    }, top);
    await page.waitForFunction(
      ({ home, top }) => Math.abs(document.querySelector(home).scrollTop - top) < 1,
      { home, top },
    );
    // Let the passive scroll handler request its new window before sending traffic.
    await page.evaluate(
      () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
    );
  };
  let time = arrival.created_at;
  const add = async (text) => {
    const event = await sign(1, text, [], ++time);
    fake.add(event);
    return event;
  };
  const atHead = async (label, ...ids) => {
    await head(...ids);
    await page.waitForFunction((selector) => {
      const node = document.querySelector(selector);
      return node?.scrollTop === 0 && node.querySelector('.fresh')?.hidden;
    }, home);
    check(
      label,
      (await view.evaluate((node) => node.scrollTop)) === 0 &&
        (await pill.evaluate((node) => node.hidden)) &&
        (await view.locator(`.list > .note[data-note="${ids[0]}"]`).count()) === 1,
    );
  };

  await named();
  await shot('top-before');
  const whileOpen = await add('Home arrival while the warm page is already open');
  await atHead(
    'an arrival after warm startup appears without pressing or reloading',
    whileOpen.id,
    arrival.id,
  );
  await shot('top-after');
  await page.waitForFunction(
    (id) =>
      Object.keys(localStorage).some(
        (key) => key.startsWith('lkjstr:public-view:') && localStorage.getItem(key).includes(id),
      ),
    whileOpen.id,
  );
  await page.reload();
  await page.waitForFunction(() => globalThis.__publicCacheProbe.firstScreen !== null);
  const replay = await page.evaluate(() => globalThis.__publicCacheProbe);
  check(
    'page reload replays the warm Home head before the native Worker',
    replay.created.length === 0 &&
      (await view.locator('.list > .note').first().getAttribute('data-note')) === whileOpen.id,
  );
  await head(whileOpen.id);
  await page.waitForFunction(() => globalThis.__publicCacheProbe.ready !== null);
  const afterReload = await add('Home arrival after reloading at the top');
  await atHead('arrival after reload appears automatically', afterReload.id, whileOpen.id);

  await named();
  await scroll(450);
  const before = await readingPlace();
  await shot('scrolled-before');
  const older = await add('Home arrival while the reader is scrolled');
  await view.getByRole('button', { name: '1 new', exact: true }).waitFor();
  const newer = await add('Second Home arrival while the reader is scrolled');
  await view.getByRole('button', { name: '2 new', exact: true }).waitFor();
  await head(newer.id, older.id, afterReload.id);
  const held = await readingPlace();
  const shift = Math.abs(held.offset - before.offset);
  const arrivalCount = await view
    .locator('.list > .note')
    .evaluateAll(
      (rows, oldHead) => rows.findIndex((row) => row.dataset.note === oldHead),
      afterReload.id,
    );
  check(
    'the pill counts exactly the two inserted rows above the unmoved anchor',
    held.id === before.id && shift === 0 && arrivalCount === 2,
    { before, held, shift, arrivalCount },
  );
  await shot('scrolled-after');
  await page.reload();
  await page.waitForFunction(() => globalThis.__publicCacheProbe.ready !== null);
  await head(newer.id, older.id, afterReload.id);
  await view.getByRole('button', { name: '2 new', exact: true }).waitFor();
  const restored = await readingPlace();
  check(
    'reload while scrolled restores the same anchor and unread rows',
    restored.id === before.id && restored.offset === before.offset,
  );
  const whileRestored = await add('Home arrival after reloading while scrolled');
  await view.getByRole('button', { name: '3 new', exact: true }).waitFor();
  await head(whileRestored.id, newer.id, older.id);
  check(
    'an arrival after scrolled reload holds the restored anchor',
    JSON.stringify(await readingPlace()) === JSON.stringify(restored),
  );
  await scroll(0);
  await atHead(
    'scrolling to the top clears the count and reveals the arrivals in order',
    whileRestored.id,
    newer.id,
  );
  check(
    'each pending arrival is drawn once',
    (await view.locator(`.list > .note[data-note="${older.id}"]`).count()) === 1,
  );

  await scroll(450);
  const forPill = await add('Home arrival revealed by the pill');
  await view.getByRole('button', { name: '1 new', exact: true }).click();
  await atHead(
    'pressing the pill returns to the top and reveals the arrival',
    forPill.id,
    whileRestored.id,
  );

  await page.keyboard.press('j');
  const selected = view.locator('.list > .note.sel');
  const selectedPlace = () =>
    selected.evaluate((row) => ({
      id: row.dataset.note,
      y: row.getBoundingClientRect().top,
    }));
  const selection = await selectedPlace();
  const whileSelected = await add('Home arrival above the selected row');
  await head(whileSelected.id, forPill.id);
  check(
    'keyboard selection stays at the same screen position',
    JSON.stringify(await selectedPlace()) === JSON.stringify(selection),
  );
  await view.getByRole('button', { name: '1 new', exact: true }).click();
  await atHead('the pill clears a held keyboard selection', whileSelected.id, forPill.id);
  check('the selected row is released at the head', (await selected.count()) === 0);

  await page.locator('.tab[data-view="settings"]').click();
  await view.waitFor({ state: 'hidden' });
  const away = await add('Home arrival while another tab is selected');
  await page.locator('.tab[data-view="home"]').click();
  await atHead('returning to Home follows its head at once', away.id, whileSelected.id);

  const previousConnection = delivered.get(away.id);
  disconnect();
  const reconnected = await add('Home arrival after the relay reconnects');
  await atHead(
    'reconnect supplies an arrival and keeps the previous head',
    reconnected.id,
    away.id,
  );
  const connection = delivered.get(reconnected.id);
  check(
    'the reconnected relay actually replayed the previous head and it still occurs once',
    connection > previousConnection &&
      connection === delivered.get(away.id) &&
      (await view.locator(`.list > .note[data-note="${away.id}"]`).count()) === 1,
  );
  if (overflow) {
    await scroll(450);
    const retained = await readingPlace();
    const at = ++time;
    for (let i = 0; i < 744; i++) fake.add(await sign(1, `Overflow fixture note ${i}`, [], at));
    const latest = await add('Home head outside the held window');
    const overflowing = view.getByRole('button', {
      name: 'More new notes than this list holds. Press to go to the latest.',
      exact: true,
    });
    await overflowing.waitFor({ timeout: 30000 });
    const [shown, total] = await view
      .locator('.list > .note')
      .evaluateAll(
        (rows, previousHead) => [
          rows.findIndex((row) => row.dataset.note === previousHead),
          rows.length,
        ],
        reconnected.id,
      );
    check(
      'overflow gives the retained count, bounds the window, and still holds the anchor',
      shown === 740 &&
        total <= 800 &&
        (await overflowing.innerText()) === `${shown}+ new` &&
        JSON.stringify(await readingPlace()) === JSON.stringify(retained),
    );
    await shot('overflow');
    await scroll(0);
    check(
      'scrolling to the retained edge leaves the overflow disclosure',
      await overflowing.isVisible(),
    );
    await overflowing.click();
    await atHead('overflow pill reloads the real head', latest.id);
  }
  return { heldOffsetChangePx: shift, arrivalCount, previousConnection, connection };
}

export async function checkLiveHomeWidths({
  page,
  fake,
  check,
  sign,
  arrival,
  delivered,
  stage,
  shot,
  disconnect,
}) {
  const results = [];
  for (const width of [1440, 390]) {
    stage(`live Home at ${width}px after warm replay and reload`);
    if (width === 390) {
      await page.setViewportSize({ width, height: 844 });
      await page.reload();
      await page.waitForFunction(() => globalThis.__publicCacheProbe.ready !== null);
      const id = await page
        .locator('.view[data-kind="home"]:visible .list > .note')
        .first()
        .getAttribute('data-note');
      arrival = fake.stored.find((event) => event.id === id);
      check('the phone starts from the current signed Home head', Boolean(arrival));
    }
    const proof = await checkLiveHome({
      page,
      fake,
      sign,
      arrival,
      delivered,
      disconnect,
      overflow: width === 390,
      check: (name, ok, detail) => check(`${width}px: ${name}`, ok, detail),
      shot: (name) => shot(width, name),
    });
    results.push({ width, deviceScaleFactor: 1, ...proof });
  }
  return results;
}
