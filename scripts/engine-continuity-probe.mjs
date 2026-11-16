// Bounded observation. A failed 15-second assertion remains failed after capture.
export async function installContinuityProbe(page) {
  await page.evaluate(() => {
    const p = window.continuityProbe = { startedAt: Date.now(), samples: [], states: [], timelines: [], dropped: 0, sequence: 0 };
    const keep = (list, value, cap) => { if (list.length < cap) list.push(value); else p.dropped++; };
    window.worker.addEventListener('message', e => {
      const m = e.data, at = Date.now();
      if (m.sub === 'continuity') {
        p.lastOutputAt = at;
        if (m.t === 'state') { p.state = m.state; keep(p.states, { at, state: m.state }, 256); }
        if (m.t === 'rows') { p.atTop = m.atTop; p.atBottom = m.atBottom; }
        if (m.t === 'timeline') { p.timeline = m; const { positions, ...value } = m.timeline; keep(p.timelines, { at, value, positions: positions?.length }, 128); }
      }
      if (m.t === 'stats' && m.req === p.pending) {
        p.stats = { at, sentAt: p.sentAt, totals: m.stats.totals, relays: m.stats.relays.map(r => ({ url: r.url, eventsReceived: r.eventsReceived, duplicatesDropped: r.duplicatesDropped })) };
        p.pending = null;
      }
    });
    p.timer = setInterval(() => {
      const at = Date.now();
      keep(p.samples, { at, rows: window.continuityRows?.length ?? 0, progress: window.continuityProgress, lastOutputAt: p.lastOutputAt, stats: p.stats, pendingSince: p.pending ? p.sentAt : null }, 360);
      if (!p.pending && p.sequence < 360) {
        p.pending = `continuity-probe-${++p.sequence}`; p.sentAt = at;
        window.worker.postMessage({ t: 'stats', req: p.pending });
      }
    }, 1000);
  });
}
async function snapshot(page) {
  return page.evaluate(async () => {
    const p = window.continuityProbe, at = Date.now();
    const view = { at, progress: window.continuityProgress, rows: window.continuityRows?.map(r => ({ key: r.key, at: r.at })), state: p?.state, timeline: p?.timeline, atTop: p?.atTop, atBottom: p?.atBottom, lastOutputAt: p?.lastOutputAt, stats: p?.stats };
    let db;
    try {
      db = await new Promise((ok, bad) => { const r = indexedDB.open('lkjstr-wasm'); r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error); });
      view.physical = await new Promise((ok, bad) => { const r = db.transaction('events', 'readonly').objectStore('events').getAllKeys(); r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error); });
    } catch (error) { view.physicalError = String(error); } finally { db?.close(); }
    return view;
  });
}
export async function captureContinuity(page, history, failure = false) {
  const result = { initial: await snapshot(page), initialFailure: failure };
  if (failure) {
    await page.waitForTimeout(15000);
    result.afterObservation = await snapshot(page);
    result.observationMs = result.afterObservation.at - result.initial.at;
  }
  await page.evaluate(() => {
    window.worker.postMessage({ t: 'stats', req: 'continuity-final-stats' });
    window.worker.postMessage({ t: 'open', sub: 'continuity-diagnostics', query: { source: 'diagnostics' } });
  });
  try {
    await page.waitForFunction(() => window.messages.some(m => m.t === 'stats' && m.req === 'continuity-final-stats') && window.messages.some(m => m.t === 'rows' && m.sub === 'continuity-diagnostics'), null, { timeout: 5000 });
  } catch (error) { result.diagnosticError = String(error); }
  const extra = await page.evaluate(() => {
    const p = window.continuityProbe;
    if (p) clearInterval(p.timer);
    const rows = window.messages.filter(m => m.t === 'rows' && m.sub === 'continuity-diagnostics').at(-1)?.rows ?? [];
    return { pageTimes: window.continuityPageTimes, samples: p?.samples, states: p?.states, timelines: p?.timelines, droppedSamples: p?.dropped,
      stats: window.messages.filter(m => m.t === 'stats' && m.req === 'continuity-final-stats').at(-1)?.stats,
      diagnostics: Object.fromEntries(rows.map(r => [r.label, JSON.parse(r.value)])) };
  });
  Object.assign(result, extra);
  result.afterDiagnostics = await snapshot(page);
  for (const sample of [result.initial, result.afterObservation, result.afterDiagnostics].filter(Boolean)) {
    const visible = new Set(sample.rows?.map(r => r.key)), physical = new Set(sample.physical);
    sample.missingVisible = history.filter(e => !visible.has(e.id)).map(e => ({ id: e.id, at: e.created_at }));
    sample.missingPhysical = history.filter(e => !physical.has(e.id)).map(e => ({ id: e.id, at: e.created_at }));
  }
  return result;
}
