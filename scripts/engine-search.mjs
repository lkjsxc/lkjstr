// Existing Search contract through real Worker bytes; every fixture stays on loopback.
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { fixtureProcess } from './engine-fixture-process.mjs';

export async function searchContract({ page, send, wait, check, account, fake }) {
  const child = fixtureProcess('engine-fixtures', { stdio: ['pipe', 'pipe', 'pipe'] });
  child.stderr.resume();
  const subs = [];
  try {
    const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
    const next = async () => {
      let timer;
      try {
        const line = await Promise.race([lines.next(), new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Search fixture deadline')), 15000);
        })]);
        if (line.done) throw new Error('Search fixture ended');
        return JSON.parse(line.value);
      } finally { clearTimeout(timer); }
    };
    const fixture = (await next()).note;
    const sign = async (kind, at, content) => {
      child.stdin.write(`${JSON.stringify({
        pubkey: fixture.pubkey, kind, created_at: at, content, tags: [],
      })}\n`);
      return next();
    };
    await page.evaluate(() => {
      const previous = window.worker.onmessage;
      const rows = {}, fresh = {}, timelines = {};
      const listener = (event) => {
        previous(event);
        const m = event.data;
        if (!m.sub?.startsWith('search-contract-')) return;
        if (m.t === 'rows') rows[m.sub] = m.rows.slice();
        if (m.t === 'fresh') fresh[m.sub] = m.count;
        if (m.t === 'timeline') timelines[m.sub] = m.timeline;
        if (m.t === 'patch') for (const op of m.ops) {
          const values = rows[m.sub] ??= [];
          const key = op.op === 'update' ? op.row.key : op.key;
          const at = values.findIndex((row) => row.key === key);
          if (op.op === 'remove' && at >= 0) values.splice(at, 1);
          if (op.op === 'update' && at >= 0) values[at] = op.row;
          if (op.op === 'insert') {
            const index = op.before === null ? -1 : values.findIndex((row) => row.key === op.before);
            values.splice(index < 0 ? values.length : index, 0, ...op.rows);
          }
        }
      };
      window.searchContract = { previous, listener, rows, fresh, timelines };
      window.worker.onmessage = listener;
    });
    const open = async (name, language, count) => {
      const sub = `search-contract-${name}`;
      subs.push(sub);
      await send({ t: 'open', sub, query: {
        source: 'search', account, text: 'searchboundary cached', language,
      } });
      await send({ t: 'window', sub, anchor: 'top', before: 0, after: 2 });
      await send({ t: 'hint', hint: {
        visibleSubs: [sub], pageHidden: false, idle: false, saveData: false,
      } });
      await wait(({ sub, count, author }) => {
        const rows = window.searchContract.rows[sub] ?? [];
        return rows.filter((r) => r.kind === 'note').length === count &&
          rows.filter((r) => r.kind === 'person' && r.author.pubkey === author).length === 1;
      }, { sub, count, author: fixture.pubkey });
      return sub;
    };
    const read = (sub) => page.evaluate((sub) => window.searchContract.rows[sub], sub);
    const profile = await sign(0, 1700400000,
      JSON.stringify({ name: 'searchboundary', display_name: 'cached directory' }));
    const older = await sign(1, 1700400000, 'searchboundary cached earlier');
    const english = await sign(1, 1700400001, 'searchboundary cached English');
    const japanese = await sign(1, 1700400002, 'searchboundary cached 日本語');
    for (const event of [profile, older, english, japanese]) fake.add(event);
    const sub = await open('top', undefined, 2);
    const rows = await read(sub);
    const person = rows.find((r) => r.kind === 'person');
    check('Search supplies matching retained people before the complete two-note budget',
      rows[0] === person && rows.slice(1).map((r) => r.id).join(',') ===
      [japanese.id, english.id].join(',') && person.key === `search-person:${fixture.pubkey}`);
    await wait((sub) => {
      const value = window.searchContract.timelines[sub];
      return value?.supported && value.months.reduce((n, m) => n + m.count, 0) === 3 &&
        value.positions.length === 2;
    }, sub);
    check('Search people do not add time-rail months or positions', true);
    const mark = await page.evaluate(() => window.messages.length);
    await send({ t: 'window', sub, anchor: { key: person.key }, before: 0, after: 2 });
    await wait(({ sub, mark }) => window.messages.slice(mark).some((m) =>
      m.t === 'rows' && m.sub === sub && m.rows.length === 3), { sub, mark });
    check('Search person anchor holds the real first-note boundary',
      (await read(sub)).filter((r) => r.kind === 'note').map((r) => r.id).join(',') ===
      [japanese.id, english.id].join(','));
    await send({ t: 'window', sub, anchor: { key: english.id }, before: 0, after: 1 });
    await wait(({ sub, id }) => {
      const value = window.searchContract;
      return value.rows[sub]?.length === 1 && value.rows[sub][0].id === id &&
        value.fresh[sub] === 1;
    }, { sub, id: english.id });
    check('Search held note windows exclude people from Fresh and row budgets', true);
    await send({ t: 'close', sub });
    for (const [name, language, count] of [
      ['union-ja-first', ['ja', 'en'], 2], ['union-en-first', ['en', 'ja'], 2],
      ['ja-only', ['ja'], 1],
    ]) {
      const sub = await open(name, language, count);
      check(`Search language filter ${name} uses the exact existing array`,
        (await read(sub)).filter((r) => r.kind === 'note').length === count);
      await send({ t: 'close', sub });
    }
  } finally {
    for (const sub of subs) await send({ t: 'close', sub }).catch(() => {});
    await page.evaluate(() => {
      const saved = window.searchContract;
      if (saved && window.worker.onmessage === saved.listener)
        window.worker.onmessage = saved.previous;
      delete window.searchContract;
    }).catch(() => {});
    child.stdin.end();
    if (child.exitCode === null) {
      const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
      try { await once(child, 'close'); } finally { clearTimeout(timer); }
    }
  }
}
