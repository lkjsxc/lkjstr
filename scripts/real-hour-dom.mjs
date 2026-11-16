// Measurement only: connected top-level feed membership, never viewport or compositor paint.
export function observeDom({ limit = 40000 } = {}) {
  if (!globalThis.document || globalThis.__realHourDomSnapshot) return;
  if (!Number.isInteger(limit) || limit < 1 || limit > 40000) throw Error('DOM evidence limit must be 1..40000');
  const names = ['home', 'notifications', 'thread'];
  const first = Object.fromEntries(names.map(name => [name, Object.create(null)]));
  const sources = Object.fromEntries(names.map(name => [name,
    { count: 0, dropped: 0, saturated: false, unknown: [], scopeSeen: false, active: false }]));
  const state = { schema: 1, installed: true, limit, started: Date.now(), stopped: false, sources };
  const mark = (name, reason) => {
    const out = sources[name];
    if (!out.unknown.includes(reason) && out.unknown.length < 8) out.unknown.push(reason);
  };
  const resolve = (name, required = false) => {
    const out = sources[name];
    const views = document.querySelectorAll(`.view.feed[data-kind="${name}"]`);
    out.active = false;
    if (!views.length) return;
    if (views.length !== 1) { mark(name, 'multiple-mounted-source-views'); return; }
    const view = views[0], body = view.parentElement, tab = body?.dataset.view;
    if (!body?.matches('.body.own') || (name === 'thread' ? !tab?.startsWith('thread') : tab !== name)) {
      mark(name, 'unsupported-view-owner'); return;
    }
    const lists = view.querySelectorAll(':scope > .list');
    if (lists.length !== 1) { if (required) mark(name, 'unsupported-row-container'); return; }
    const query = globalThis.__realHour?.views[name]?.query;
    const open = Object.values(globalThis.__realHour?.sources ?? {}).filter(source => source === name).length;
    const account = globalThis.__realHourExpectedAccount;
    if (!/^[0-9a-f]{64}$/.test(account ?? '') || query?.source !== name || query.account !== account || open !== 1) {
      if (required || lists[0].querySelector(':scope > .note[data-note]')) mark(name, 'unsupported-account-or-query-attribution');
      return;
    }
    const focus = name === 'thread' ? query.id : undefined;
    if (name === 'thread' && !/^[0-9a-f]{64}$/.test(focus ?? '')) { mark(name, 'unsupported-thread-focus'); return; }
    const scope = { account, tab, ...(focus ? { focus } : {}) };
    if (out.scope && JSON.stringify(out.scope) !== JSON.stringify(scope)) { mark(name, 'source-scope-changed'); return; }
    out.scope ??= scope; out.scopeSeen = true; out.active = true;
    return { view, list: lists[0] };
  };
  const record = (node, scope, name, at) => {
    if (!node.isConnected || node.parentElement !== scope.list || !node.matches('.note[data-note]')) return;
    const id = node.dataset.note;
    if (!/^[0-9a-f]{64}$/.test(id ?? '')) { mark(name, 'unsupported-note-identity'); return; }
    if (first[name][id] !== undefined) return;
    const out = sources[name];
    if (out.count >= limit) { out.dropped++; out.saturated = true; return; }
    first[name][id] = at; out.count++;
    if (out.count === limit) out.saturated = true;
  };
  const visit = (node, candidates, changed) => {
    if (node.nodeType !== 1) return;
    if (node.matches('.note[data-note]')) candidates.add(node);
    for (const note of node.querySelectorAll('.list > .note[data-note]')) candidates.add(note);
    if (node.matches('.view.feed')) changed.add(node.dataset.kind);
    for (const view of node.querySelectorAll('.view.feed')) changed.add(view.dataset.kind);
    if (node.matches('.body.own')) for (const view of node.querySelectorAll(':scope > .view.feed')) changed.add(view.dataset.kind);
  };
  const collect = (records) => {
    if (state.stopped) return;
    const candidates = new Set(), changed = new Set();
    for (const change of records) {
      if (change.type === 'childList') for (const node of change.addedNodes) visit(node, candidates, changed);
      else if (change.target.matches('.note[data-note], .view.feed, .body.own')) visit(change.target, candidates, changed);
    }
    for (const node of candidates) changed.add(node.closest('.view.feed')?.dataset.kind);
    const at = Date.now();
    for (const name of names) {
      if (!changed.has(name)) continue;
      const scope = resolve(name, candidates.size > 0);
      if (!scope) continue;
      for (const node of candidates) record(node, scope, name, at);
    }
  };
  const observer = new MutationObserver(collect);
  observer.observe(document, { childList: true, subtree: true, attributes: true,
    attributeFilter: ['data-note', 'data-kind', 'data-view', 'class'] });
  const refresh = (name) => {
    if (state.stopped) return;
    collect(observer.takeRecords());
    const at = Date.now();
    for (const source of names) if (!name || source === name) {
      const scope = resolve(source);
      if (scope) for (const node of scope.list.children) record(node, scope, source, at);
    }
  };
  globalThis.__realHourDomRefresh = refresh;
  globalThis.__realHourDomSnapshot = (includeFirst = false) => {
    collect(observer.takeRecords());
    for (const name of names) {
      const scope = resolve(name);
      if (!scope) continue;
      const pill = scope.view.querySelector('.fresh');
      sources[name].last = { at: Date.now(), listChildren: scope.list.children.length,
        scrollTop: scope.view.scrollTop, fresh: pill ? { hidden: pill.hidden, text: (pill.textContent ?? '').slice(0, 120) } : null };
    }
    return { ...state, ...(includeFirst ? { first } : {}) };
  };
  globalThis.__realHourDomStop = () => {
    collect(observer.takeRecords()); observer.disconnect(); state.stopped = true;
    for (const name of names) mark(name, 'observer-stopped');
  };
  refresh();
}

export async function readObservation(page) {
  return page.evaluate(() => ({ capturedAt: Date.now(), wireFirst: globalThis.__realHour?.wireFirst ?? {},
    dom: globalThis.__realHourDomSnapshot?.(true),
    views: Object.fromEntries(['home', 'notifications', 'thread'].map(source => [source, globalThis.__realHour?.views[source] ?? {}])) }));
}

export function observationFor(snapshot, source, id, cutoff) {
  const wireFirstAt = snapshot?.wireFirst?.[source]?.[id];
  const domFirstAt = snapshot?.dom?.first?.[source]?.[id];
  return { wireFirstAt, domFirstAt, wireByCutoff: Number.isFinite(wireFirstAt) && wireFirstAt <= cutoff,
    domByCutoff: Number.isFinite(domFirstAt) && domFirstAt <= cutoff,
    domDuringGrace: Number.isFinite(domFirstAt) && domFirstAt > cutoff,
    wireToDomFirstObservedMs: Number.isFinite(wireFirstAt) && Number.isFinite(domFirstAt) && domFirstAt >= wireFirstAt ? domFirstAt - wireFirstAt : undefined,
    kind: 'connected top-level source DOM membership; not viewport visibility or compositor paint' };
}


export function domStatus(dom, source) {
  const item = dom?.sources?.[source];
  if (!dom?.installed || dom.stopped || !item?.scopeSeen) return 'unknown: DOM source attribution unavailable';
  if (item.saturated || item.dropped || item.unknown?.length) return 'unknown: DOM evidence limit or attribution failure';
  return 'scoped DOM membership only; viewport/compositor unmeasured';
}

export function mergeObservations(...snapshots) {
  const present = snapshots.filter(Boolean);
  const out = { capturedAt: Math.max(0, ...present.map(item => item.capturedAt ?? 0)), wireFirst: {}, views: {},
    dom: { installed: present.some(item => item.dom?.installed), stopped: present.some(item => item.dom?.stopped),
      sources: {}, first: {} } };
  for (const source of ['home', 'notifications', 'thread']) {
    const metadata = present.map(item => item.dom?.sources?.[source]).filter(Boolean);
    const unknown = [...new Set(metadata.flatMap(item => item.unknown ?? []))].slice(0, 8);
    if (present.some(item => item.capturedAt > 0 && (!item.dom?.installed || !item.dom.sources?.[source])))
      unknown.push('captured-dom-witness-unavailable');
    const scopes = new Set(metadata.filter(item => item.scope).map(item => JSON.stringify(item.scope)));
    if (scopes.size > 1 && !unknown.includes('source-scope-changed')) unknown.push('source-scope-changed');
    const item = out.dom.sources[source] = { ...metadata.at(-1), scopeSeen: metadata.some(item => item.scopeSeen),
      count: 0, dropped: Math.max(0, ...metadata.map(item => item.dropped ?? 0)),
      saturated: metadata.some(item => item.saturated), unknown };
    for (const [field, target] of [['wireFirst', out.wireFirst], ['dom', out.dom.first]]) {
      const first = target[source] = Object.create(null); let count = 0;
      for (const snapshot of present) for (const [id, at] of Object.entries(field === 'dom' ? snapshot.dom?.first?.[source] ?? {} : snapshot.wireFirst?.[source] ?? {})) {
        if (first[id] === undefined && count >= 40000) { item.saturated = true; continue; }
        if (first[id] === undefined) { first[id] = at; count++; } else first[id] = Math.min(first[id], at);
      }
    }
    item.count = Object.keys(out.dom.first[source]).length;
    if (item.count >= 40000) item.saturated = true;
    for (const snapshot of present) if (snapshot.views?.[source]) out.views[source] = snapshot.views[source];
  }
  return out;
}
