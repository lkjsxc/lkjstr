// Bounded post-hour DOM membership. No nested quote, other tile or cache inference.
import { delay } from './real-hour-public.mjs';
export function historicalDom({ source, account, focus, expiresAt }) {
  if (expiresAt !== undefined && Date.now() > expiresAt) return { at: Date.now(), unknown: ['expired browser observation'], ids: [] };
  const at = Date.now(), unknown = [], state = globalThis.__realHour;
  const dom = globalThis.__realHourDomSnapshot?.(), metadata = dom?.sources?.[source];
  const query = state?.views?.[source]?.query, opened = Object.values(state?.sources ?? {}).filter(value => value === source).length;
  const views = document.querySelectorAll(`.view.feed[data-kind="${source}"]`);
  const view = views.length === 1 ? views[0] : undefined, body = view?.parentElement;
  const tab = body?.dataset.view, list = view?.querySelector(':scope > .list');
  if (!dom?.installed || dom.stopped || !metadata?.scopeSeen || metadata.unknown?.length || metadata.saturated || metadata.dropped)
    unknown.push('DOM witness missing, saturated or ambiguous');
  if (!view || !body?.matches('.body.own') || !view.getClientRects().length || !list ||
      (source === 'thread' ? !tab?.startsWith('thread') : tab !== source)) unknown.push('source view is not uniquely mounted');
  if (!/^[0-9a-f]{64}$/.test(account ?? '') || query?.source !== source || query.account !== account || opened !== 1 ||
      (source === 'thread' && (!/^[0-9a-f]{64}$/.test(focus ?? '') || query.id !== focus))) unknown.push('account or focus attribution unavailable');
  const rows = [...(list?.querySelectorAll(':scope > .note[data-note]') ?? [])]
    .filter(note => note.isConnected && note.parentElement === list);
  if (rows.length > 6000) unknown.push('DOM row limit');
  const ids = rows.slice(0, 6000).map(note => note.dataset.note);
  if (ids.some(id => !/^[0-9a-f]{64}$/.test(id ?? ''))) unknown.push('unsupported note identity');
  return { at, source, account, focus, query, unknown, ids: unknown.length ? [] : ids,
    window: state?.views?.[source]?.window, state: state?.views?.[source]?.state,
    atTop: state?.views?.[source]?.atTop, atBottom: state?.views?.[source]?.atBottom,
    scrollTop: view?.scrollTop, height: view?.scrollHeight,
    groupRowsExcluded: list?.querySelectorAll(':scope > .notif').length ?? 0,
    fresh: state?.views?.[source]?.fresh,
    wireFirst: Object.fromEntries(ids.map(id => [id, state?.wireFirst?.[source]?.[id]])) };
}
export async function historyDeadline(run, deadlineAt = Date.now() + 5000) {
  const left = Math.min(5000, deadlineAt - Date.now());
  if (left <= 0) throw Error('historical phase deadline');
  let timer;
  try { return await Promise.race([run(Date.now() + left), new Promise((_, no) => {
    timer = setTimeout(() => no(Error('historical browser/RPC deadline')), left);
  })]); } finally { clearTimeout(timer); }
}
export async function captureHistorical(page, scope, deadlineAt) {
  return historyDeadline(expiresAt => page.evaluate(historicalDom, { ...scope, expiresAt }), deadlineAt);
}
export async function walkHistoricalSource({ page, scope, ids, deadlineAt, actions = 8 }) {
  const startedAt = Date.now(), snapshots = [], domFirst = {}, unknown = [];
  let last, signature, firstQuery, used = 0, count = 0;
  const scan = async () => {
    const value = await captureHistorical(page, scope, deadlineAt);
    for (const reason of value.unknown) if (!unknown.includes(reason)) unknown.push(reason);
    const query = JSON.stringify(value.query);
    if (firstQuery !== undefined && firstQuery !== query && !unknown.includes('source query changed')) unknown.push('source query changed');
    firstQuery ??= query;
    if (!unknown.length) for (const id of value.ids) {
      if (domFirst[id] !== undefined) continue;
      if (count >= 6000) { unknown.push('phase membership limit'); break; }
      domFirst[id] = value.at; count++;
    }
    last = value; return value;
  };
  try {
    for (let action = 0; action <= actions && Date.now() < deadlineAt; action++) {
      const value = await scan(); snapshots.push(value);
      if (unknown.length || ids.every(id => domFirst[id] !== undefined)) break;
      if (action === actions) break;
      signature = [value.ids.length, value.ids[0], value.ids.at(-1), JSON.stringify(value.window)].join(':');
      await historyDeadline(expiresAt => page.evaluate(({ source, expiresAt }) => {
        if (Date.now() > expiresAt) return;
        const view = document.querySelector(`.view.feed[data-kind="${source}"]`);
        if (view) { view.scrollTop = Math.max(0, view.scrollHeight - view.clientHeight); view.dispatchEvent(new Event('scroll')); }
      }, { source: scope.source, expiresAt }), deadlineAt);
      used++;
      const waitEnd = Math.min(deadlineAt, Date.now() + 15000);
      do {
        await delay(Math.min(250, Math.max(0, waitEnd - Date.now())));
        const next = await scan();
        if (unknown.length || ids.every(id => domFirst[id] !== undefined) ||
            [next.ids.length, next.ids[0], next.ids.at(-1), JSON.stringify(next.window)].join(':') !== signature) break;
      } while (Date.now() < waitEnd);
    }
  } catch (error) { unknown.push(String(error).slice(0, 200)); }
  if (last && snapshots.at(-1) !== last) snapshots.push(last);
  const pending = ids.filter(id => domFirst[id] === undefined);
  return { startedAt, finishedAt: Date.now(), scope, actions: used, snapshots, domFirst, unknown,
    pending, limitReached: pending.length > 0 && (used >= actions || Date.now() >= deadlineAt),
    interpretation: 'First sampled connected top-level DOM membership during this phase, not viewport/compositor paint or exact insertion time.' };
}
export async function mountHistoricalThread({ page, account, focus, deadlineAt }) {
  const scope = { source: 'home', account };
  const exercise = await walkHistoricalSource({ page, scope, ids: [focus], deadlineAt });
  if (!exercise.domFirst[focus] || exercise.unknown.length) return { exercise, status: 'unknown: selected focus was not reached in the bounded Home window' };
  const clicked = await historyDeadline(expiresAt => page.evaluate(({ id, expiresAt }) => {
    if (Date.now() > expiresAt) return false;
    const views = document.querySelectorAll('.view.feed[data-kind="home"]');
    if (views.length !== 1) return false;
    const node = [...views[0].querySelectorAll(':scope > .list > .note[data-note]')].find(note => note.dataset.note === id);
    const action = node?.querySelector(':scope > .nrow > .nmain > .nhead > time');
    if (!action || !node.isConnected) return false;
    action.click(); return true;
  }, { id: focus, expiresAt }), deadlineAt);
  return { exercise, status: clicked ? 'selected focus opened through its existing note action' : 'unknown: selected focus no longer mounted for its action', clicked };
}

export async function restoreHistorical(page, source, focus, account) {
  return historyDeadline(expiresAt => page.evaluate(({ source, focus, account, expiresAt }) => {
    if (Date.now() > expiresAt) return false;
    if (source === 'thread') {
      const query = globalThis.__realHour?.views.thread?.query;
      if (query?.account === account && query.id === focus)
        document.querySelector('.tab.active[data-view^="thread"] > .x')?.click();
      document.querySelector('.tab[data-view="home"]')?.click(); source = 'home';
    }
    const view = document.querySelector(`.view.feed[data-kind="${source}"]`);
    if (!view) return false;
    view.querySelector('.fresh')?.click(); view.scrollTop = 0; view.dispatchEvent(new Event('scroll'));
    return true;
  }, { source, focus, account, expiresAt }));
}
