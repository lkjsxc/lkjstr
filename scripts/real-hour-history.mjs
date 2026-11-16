// Historical witnesses run after the immutable live-hour cutoff, never in its denominator.
import { writeFile } from 'node:fs/promises';
import { controlBudget } from './real-hour-budget.mjs';
import { queryRelay, delay } from './real-hour-public.mjs';
import { nativeEligibility, publicContext } from './real-hour-audit.mjs';
import { sourceFilter, evidenceStatus } from './real-hour-coverage.mjs';
import { captureHistorical, walkHistoricalSource, mountHistoricalThread, historyDeadline, restoreHistorical } from './real-hour-history-dom.mjs';
import { compareHistorical } from './real-hour-history-compare.mjs';
async function actualControls(relays, filter, deadlineAt) {
  const budget = controlBudget({ milliseconds: Math.max(0, deadlineAt - Date.now()) });
  const responses = await Promise.all(relays.slice(0, 3).map(relay =>
    queryRelay(relay, [{ ...filter, limit: 200 }], Math.min(15000, budget.remaining()), { budget })));
  const events = new Map(), seenOn = {}, firstSeenOn = {};
  for (const response of responses) for (const event of response.events) {
    events.set(event.id, event);
    (seenOn[event.id] ??= []).push(response.relay);
    (firstSeenOn[event.id] ??= {})[response.relay] = response.firstSeenAt[event.id];
  }
  return { filter, responses, events: [...events.values()], seenOn, firstSeenOn, budget: budget.snapshot() };
}
const queryEvidence = cdp => cdp.queryEvidence ? cdp.queryEvidence() : cdp.queries().then(queries =>
  ({ queries, hostNetwork: cdp.networkEvidence?.summary() }));
const overlaps = (filter, span) => (filter.since ?? 0) <= span.until && (filter.until ?? Infinity) >= span.since;
async function sourceWitness({ measured, page, account, source, plan, span, directory, startedAt, deadlineAt, beforeCache }) {
  const scope = { source, account: account.pubkey, ...(plan.focus ? { focus: plan.focus } : {}) };
  const exercise = await walkHistoricalSource({ page, scope, ids: plan.ids ?? [], deadlineAt: deadlineAt - 20000 });
  const cutoff = exercise.finishedAt, snapshot = await historyDeadline(() => queryEvidence(measured.cdp), deadlineAt);
  const relevant = snapshot.queries.filter(query => query.at <= cutoff && query.filters.some(filter =>
    sourceFilter(filter, source, account, plan.focus) && overlaps(filter, span)));
  const routes = [...new Set(relevant.slice().sort((a, b) => b.at - a.at).map(query => query.relay))];
  const selectedRoutes = routes.slice(0, 3);
  const filter = { kinds: source === 'notifications' ? [1] : [1, 42],
    [source === 'notifications' ? '#p' : '#e']: [source === 'notifications' ? account.pubkey : plan.focus], ...span };
  const control = await actualControls(selectedRoutes, filter, deadlineAt);
  await writeFile(`${directory}/historical-${source}-controls.json`, JSON.stringify(control));
  const afterCache = await historyDeadline(() => publicContext(page), deadlineAt), query = exercise.snapshots.at(-1)?.query;
  const unknown = [];
  if (!query || query.source !== source || query.account !== account.pubkey ||
      (source === 'thread' && query.id !== plan.focus)) unknown.push('actual source query unavailable');
  if (query?.types !== undefined && query?.types !== null) unknown.push('historical text subset does not model selected notification type filters');
  if (afterCache.length >= 20000) unknown.push('public context read reached its physical-row bound');
  if (Date.now() >= deadlineAt) unknown.push('historical phase deadline');
  const targets = await historyDeadline(() => measured.cdp.sample(), deadlineAt);
  const evidence = evidenceStatus(targets, snapshot.hostNetwork, [source]);
  if (evidence.completeness?.startsWith('unknown:')) unknown.push(evidence.completeness);
  const native = nativeEligibility(control.events, afterCache,
    { [source]: { query: query ?? { source, account: account.pubkey, id: plan.focus }, ...span } },
    { timeoutMs: Math.max(1, deadlineAt - Date.now()), ordered: true });
  const comparison = compareHistorical({ source, account, plan, span, control, native, beforeCache, afterCache,
    exercise, queries: snapshot.queries, receipts: id => measured.cdp.networkEvidence?.forEvent(id) ?? [],
    cutoff, acquisitionStartedAt: startedAt, evidenceUnknown: unknown });
  return { ...comparison, startedAt, cutoff, finishedAt: Date.now(), selectedRoutes,
    omittedActualRoutes: routes.slice(3), actualSourceQueryCount: relevant.length, evidence,
    controlFile: `historical-${source}-controls.json`, native, exercise,
    cacheBeforeCount: beforeCache.length, cacheAfterCount: afterCache.length,
    limits: { sourceRelays: 3, pageActions: 8, phaseMilliseconds: 120000 },
    availabilityQualification: 'Independent controls are later than the DOM cutoff. Available-to-control without a prior matching source receipt remains a coverage candidate, not proven delivered-event loss.' };
}
export async function runHistoricalWitness({ measured, page, account, selection, directory }) {
  const result = { phase: 'post-hour historical witnesses', startedAt: Date.now(),
    preselectedBeforeApplication: selection?.selectedBeforeApplication === true,
    span: selection?.span, preflightFile: 'historical-preflight.json', liveDenominatorUnchanged: true };
  if (!selection?.selectedBeforeApplication || !selection.span || selection.status?.startsWith('unknown:'))
    return { ...result, status: 'unknown: no independent bounded preselection', finishedAt: Date.now() };
  const run = async (source, plan, setup) => {
    if (!plan?.ids?.length || plan.availability !== 'informative')
      return { status: plan?.availability ?? 'uninformative: no selected historical controls' };
    const startedAt = Date.now(), deadlineAt = startedAt + 120000;
    let mounted; const lifecycle = {};
    try {
      const beforeCache = await historyDeadline(() => publicContext(page), deadlineAt);
      if (setup) {
        mounted = await mountHistoricalThread({ page, account: account.pubkey, focus: plan.focus, deadlineAt: deadlineAt - 25000 });
        if (!mounted.clicked) return { ...mounted, focus: plan.focus, startedAt, finishedAt: Date.now(), lifecycle };
        const readyEnd = Math.min(deadlineAt - 20000, Date.now() + 15000);
        let ready;
        do {
          ready = await captureHistorical(page, { source: 'thread', account: account.pubkey, focus: plan.focus }, readyEnd);
          if (!ready.unknown.length) break;
          await delay(250);
        } while (Date.now() < readyEnd);
        if (ready.unknown.length) return { status: 'unknown: selected thread source did not become attributable', focus: plan.focus, mounted, ready, lifecycle };
      }
      return { ...await sourceWitness({ measured, page, account, source, plan, span: selection.span,
        directory, startedAt, deadlineAt, beforeCache }), lifecycle, ...(mounted ? { mounted } : {}) };
    } catch (error) { return { status: 'unknown: historical witness failed', error: String(error).slice(0, 500), focus: plan.focus,
      startedAt, finishedAt: Date.now(), lifecycle, ...(mounted ? { mounted } : {}) }; }
    finally {
      try { lifecycle.restored = await restoreHistorical(page, setup ? 'thread' : source, plan.focus, account.pubkey); }
      catch (error) { lifecycle.restored = false; lifecycle.restoreError = String(error).slice(0, 200); }
      lifecycle.restoredAt = Date.now();

    }
  };
  result.notifications = await run('notifications', selection.notifications);
  result.thread = await run('thread', selection.thread, true);
  result.finishedAt = Date.now();
  return result;
}
