export async function setup(browser, fixture, extensionDelay) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
  await context.route('**/*', (route) =>
    route.request().url().startsWith(fixture.origin + '/') ? route.continue() : route.abort(),
  );
  await context.exposeFunction('fixtureSign', fixture.sign);
  await context.addInitScript(({ relay, pubkey, extensionDelay }) => {
    const tile = (id, tabs) => ({ type: 'pane', id, tabs, active: tabs[0] });
    localStorage.setItem('lkjstr:migration', JSON.stringify('owner-audit-1'));
    localStorage.setItem('lkjstr:layout:guest', JSON.stringify(tile('g', ['global'])));
    localStorage.setItem('lkjstr:layout:main', JSON.stringify({
      type: 'split', id: 'r', dir: 'row', sizes: [0.5, 0.5],
      children: [tile('a', ['global']), tile('b', ['compose', 'home'])],
    }));
    const routes = JSON.stringify([{ url: relay, read: true, write: true, search: true }]);
    localStorage.setItem('lkjstr:relays:', routes);
    localStorage.setItem('lkjstr:relays:' + pubkey, routes);
    const clock = () => performance.timeOrigin + performance.now();
    const waiting = new Map();
    const rows = [];
    const trace = new Map();
    const views = new Map();
    let me, gesture, ready, feedStats, slow, unlockWorkMs, port;
    let patches = 0;
    document.addEventListener('click', (event) => {
      if (event.target.closest('.a-heart')) gesture = { kind: 'reaction', at: clock() };
      else if (event.target.closest('.view[data-kind="compose"] button')?.textContent.trim() === 'Post')
        gesture = { kind: 'note', at: clock() };
    }, true);
    const Shared = window.SharedWorker;
    window.SharedWorker = class extends Shared {
      constructor(...args) {
        super(...args);
        port = this.port;
        const original = port.postMessage.bind(port);
        port.postMessage = (msg, ...rest) => {
          if (msg.t === 'act') {
            const kind = msg.action.a === 'publish' ? msg.action.what.k : msg.action.a;
            const row = { kind, dispatch: clock(), index: rows.length };
            if (gesture?.kind === kind) {
              row.click = gesture.at;
              gesture = undefined;
            }
            rows.push(row);
            waiting.set(msg.req, row);
            msg = {
              ...msg,
              signingTiming: msg.signingTiming ?? { at: row.dispatch, hidden: document.hidden, boot: !ready },
            };
          }
          return original(msg, ...rest);
        };
        port.addEventListener('message', ({ data: msg }) => {
          const at = clock();
          if (msg.t === 'ready') ready = at;
          if (msg.t === 'accounts') {
            me = msg.active;
            if (me) localStorage.setItem('lkjstr:relays:' + me, routes);
          }
          if (msg.t === 'stats' && msg.req === 'signing-probe-stats') {
            feedStats = msg.stats.totals;
            const timing = msg.stats.signing;
            for (const sample of timing?.recent ?? []) trace.set(sample.enqueueMs, sample);
            slow = timing?.slow;
            unlockWorkMs = timing?.lastUnlockMs;
          }
          if (msg.sub === 'signing-feed-0') {
            if (msg.t === 'rows') views.set(msg.sub, msg.rows);
            if (msg.t === 'patch') {
              patches++;
              views.set(msg.sub, apply(views.get(msg.sub) ?? [], msg.ops));
            }
          }
          const row = waiting.get(msg.req);
          if (!row) return;
          if (msg.t === 'sign') row.extensionStart = at;
          if (msg.t === 'publish.signed') row.signed = at;
          if (msg.t === 'result') {
            row.finish = at;
            row.ok = msg.ok;
            row.code = msg.error?.code;
            row.id = msg.id;
            waiting.delete(msg.req);
            row.done?.(msg);
            delete row.done;
          }
        });
      }
    };
    function apply(previous, operations) {
      const rows = [...previous];
      for (const op of operations) {
        if (op.op === 'insert') {
          const existing = new Set(rows.map((row) => row.key));
          const at = rows.findIndex((row) => row.key === op.before);
          rows.splice(at < 0 ? rows.length : at, 0, ...op.rows.filter((row) => !existing.has(row.key)));
        } else {
          const at = rows.findIndex((row) => row.key === (op.key ?? op.row?.key));
          if (at < 0) continue;
          if (op.op === 'remove') rows.splice(at, 1);
          else rows[at] = op.row;
        }
      }
      return rows;
    }
    window.signProbe = {
      port: () => port,
      ready: () => ready,
      account: () => me,
      rows,
      stats: () => port.postMessage({ t: 'stats', req: 'signing-probe-stats' }),
      read() {
        const view = views.get('signing-feed-0') ?? [];
        return {
          rows, ready, feedStats, trace: [...trace.values()], slow, unlockWorkMs,
          window: {
            length: view.length, patches,
            distinct: new Set(view.map((row) => row.key)).size === view.length,
            chronological: view.every((row, i) => i === 0 || view[i - 1].at >= row.at),
          },
        };
      },
      act(action, index) {
        const req = 'signing-probe-' + index;
        port.postMessage({ t: 'act', req, action: { ...action, as: me } });
        return new Promise((done) => {
          waiting.get(req).done = done;
        });
      },
    };
    window.nostr = {
      getPublicKey: async () => pubkey,
      async signEvent(event) {
        await new Promise((done) => setTimeout(done, extensionDelay));
        return window.fixtureSign(event);
      },
    };
  }, { relay: fixture.relay, pubkey: fixture.pubkey, extensionDelay });
  return context;
}

export async function account(page, signer, bunker) {
  const action = signer === 'remote' ? { a: 'account.add', how: 'key', key: bunker }
    : { a: 'account.add', how: signer === 'extension' ? 'extension' : 'create' };
  const okay = await page.evaluate(async (action) => (await window.signProbe.act(action, 'account')).ok, action);
  if (!okay) throw new Error('Disposable account setup failed');
  await page.locator('.acct:not(.out)').waitFor();
  if (signer === 'protected') {
    return page.evaluate(async () => {
      const probe = window.signProbe;
      const password = 'loopback-session-fixture-password';
      const pubkey = probe.account();
      const backup = await probe.act({ a: 'account.exportEncrypted', pubkey, password }, 'export');
      const key = backup.encryptedKey;
      if (!backup.ok || typeof key !== 'string') throw new Error('Fixture backup refused');
      const imported = await probe.act({ a: 'account.importEncrypted', key, password }, 'import');
      const locked = await probe.act({ a: 'account.lock', pubkey }, 'lock');
      const refused = await probe.act(
        { a: 'publish', what: { k: 'note', draft: { text: 'Locked fixture note' } } },
        'locked-note',
      );
      const begin = performance.now();
      const unlocked = await probe.act({ a: 'account.unlock', pubkey, password }, 'unlock');
      if (!imported.ok || !locked.ok || refused.ok || !unlocked.ok) {
        throw new Error('Fixture lock/unlock invariant failed');
      }
      return performance.now() - begin;
    });
  }
}

export async function gestures(page) {
  // Bring the existing composer in front when the saved layout has a different active pane.
  const current = page.locator('.view[data-kind="compose"]:visible');
  if (!(await current.count())) {
    const post = page.locator('.tab[data-view="compose"]').first();
    if (await post.count()) await post.click();
  }
  await current.locator('textarea').fill('UI signing latency fixture');
  await current.getByRole('button', { name: 'Post', exact: true }).click();
  await page.waitForFunction(() => window.signProbe.rows.some((r) => r.click && r.kind === 'note' && r.ok));
  await page.locator('.view[data-kind="global"] .note').filter({ hasText: 'Engine fixture' })
    .first().locator('.a-heart').click();
  await page.waitForFunction(() => window.signProbe.rows.some((r) => r.click && r.kind === 'reaction' && r.ok));
}

export async function openFeedViews(page, count) {
  await page.evaluate((count) => {
    const probe = window.signProbe;
    const visibleSubs = [];
    for (let i = 0; i < count; i++) {
      const sub = 'signing-feed-' + i;
      visibleSubs.push(sub);
      probe.port().postMessage({ t: 'open', sub, query: { source: 'global', account: probe.account() } });
      probe.port().postMessage({ t: 'window', sub, anchor: 'top', before: 0, after: 800 });
    }
    probe.port().postMessage({
      t: 'hint', hint: { visibleSubs, focusedSub: visibleSubs[0], pageHidden: false, idle: false, saveData: false },
    });
  }, count);
}
