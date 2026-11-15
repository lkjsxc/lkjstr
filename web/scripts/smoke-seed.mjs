// What the real-engine smokes start every browser context from, and how they reach the key field.
/** These checks are about accounts and relays, not about the default layout: every context starts from an
 * arrangement saved on the device (a visitor's single tile of Global; at desktop width a reader's four tiles). */
async function seedLayouts(ctx) {
  await ctx.addInitScript(() => {
    const tile = (id, tabs) => ({ type: 'pane', id, tabs, active: tabs[0] });
    const put = (key, value) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value));
    };
    put('lkjstr:layout:guest', tile('g', ['global']));
    if (innerWidth >= 1200)
      put('lkjstr:layout:main', {
        type: 'split',
        id: 'r',
        dir: 'row',
        sizes: [0.38, 0.28, 0.34],
        children: [
          tile('a', ['home']),
          {
            type: 'split',
            id: 'c',
            dir: 'col',
            sizes: [0.64, 0.36],
            children: [tile('b', ['notifications']), tile('d', ['compose'])],
          },
          tile('e', ['global', 'bookmarks']),
        ],
      });
  });
}
/** The key field waits behind one line on the sign-in surface: opens it when it is closed. */
async function openKeyField(page) {
  const more = page.locator('.view[data-kind="account"] [data-f="other"][aria-expanded="false"]');
  if (await more.count()) await more.first().click();
}

export { openKeyField, seedLayouts };
