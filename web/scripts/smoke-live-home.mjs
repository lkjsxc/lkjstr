// Signed loopback events exercise the production render path after warm Home replay.
export async function checkLiveHome({ page, fake, check, sign, arrival, delivered, disconnect }) {
  const home = '.view[data-kind="home"]';
  const view = page.locator(home);
  const pill = view.locator('.fresh');
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
    check(
      label,
      (await view.evaluate((node) => node.scrollTop)) === 0 &&
        (await pill.evaluate((node) => node.hidden)) &&
        (await view.locator(`.list > .note[data-note="${ids[0]}"]`).count()) === 1,
    );
  };

  const whileOpen = await add('Home arrival while the warm page is already open');
  await atHead(
    'an arrival after warm startup appears without pressing or reloading',
    whileOpen.id,
    arrival.id,
  );
  await page.waitForFunction(
    (text) =>
      Object.keys(localStorage).some(
        (key) => key.startsWith('lkjstr:public-view:') && localStorage.getItem(key).includes(text),
      ),
    'Home arrival while the warm page is already open',
  );
  await page.reload();
  await page.waitForFunction(() => globalThis.__publicCacheProbe.firstScreen !== null);
  const replay = await page.evaluate(() => globalThis.__publicCacheProbe);
  check(
    'page reload replays the warm Home head before the native Worker',
    replay.created.length === 0,
  );
  await head(whileOpen.id);
  await page.waitForFunction(() => globalThis.__publicCacheProbe.ready !== null);
  const afterReload = await add('Home arrival after reloading at the top');
  await atHead('arrival after reload appears automatically', afterReload.id, whileOpen.id);

  await scroll(450);
  const before = await readingPlace();
  const older = await add('Home arrival while the reader is scrolled');
  await view.getByRole('button', { name: '1 new', exact: true }).waitFor();
  const newer = await add('Second Home arrival while the reader is scrolled');
  await view.getByRole('button', { name: '2 new', exact: true }).waitFor();
  const held = await readingPlace();
  const shift = Math.abs(held.offset - before.offset);
  check(
    'two pending arrivals preserve the visible row and offset',
    held.id === before.id && shift < 1,
  );
  await scroll(0);
  await atHead(
    'scrolling to the top clears the count and reveals the arrivals in order',
    newer.id,
    older.id,
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
    newer.id,
  );

  await page.locator('.tab[data-view="settings"]').click();
  await view.waitFor({ state: 'hidden' });
  const away = await add('Home arrival while another tab is selected');
  await page.locator('.tab[data-view="home"]').click();
  await atHead('returning to Home follows its head at once', away.id, forPill.id);

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
  return { heldOffsetChangePx: shift, previousConnection, connection };
}
