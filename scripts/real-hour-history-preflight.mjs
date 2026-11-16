// Bounded availability selection runs before any application/browser result exists.
import { publicAccount, queryRelay } from './real-hour-public.mjs';
import { nativeEligibility } from './real-hour-audit.mjs';
import { controlBudget } from './real-hour-budget.mjs';
import { candidateFoci, historicalSelection } from './real-hour-history-select.mjs';
const unique = events => [...new Map(events.map(event => [event.id, event])).values()];
export async function preflightHistorical({ relays, requested, now = Date.now,
  discover = publicAccount, query = queryRelay, verify = nativeEligibility } = {}) {
  relays = [...new Set(relays)].slice(0, 3);
  const budget = controlBudget({ now }), startedAt = now();
  const span = { since: Math.max(0, Math.floor(startedAt / 1000) - 7 * 86400), until: Math.floor(startedAt / 1000) - 1 };
  const report = { schema: 1, phase: 'historical-availability-preflight', startedAt, span,
    scope: 'Selection before application results; this is not a live-hour denominator.',
    limits: { accounts: 3, relays: 3, fociPerAccount: 3, perFilterLimit: 100 }, candidates: [], errors: [] };
  let primary, chosen;
  const request = async (urls, filters) => Promise.all(urls.slice(0, 3).map(relay =>
    query(relay, filters, Math.min(15000, budget.remaining()), { budget })));
  const native = (events, context, queries) => {
    if (!budget.remaining()) throw Error('preflight deadline or evidence budget');
    return verify(events, context, queries, { timeoutMs: budget.remaining(), relationships: true });
  };
  try {
    primary = await discover(relays, requested, { budget, includeCandidates: true });
    const candidates = (primary.candidates ?? [primary]).slice(0, requested ? 1 : 3);
    primary = { ...primary }; delete primary.candidates;
    report.primary = primary.pubkey;
    for (const account of candidates) {
      if (!budget.remaining()) break;
      const item = { account, startedAt: now(), rounds: [] }; report.candidates.push(item);
      try {
        const first = await request(account.relays, [
          { kinds: [1], '#p': [account.pubkey], ...span, limit: 100 },
          { kinds: [1], authors: [...new Set([account.pubkey, ...account.follows])], ...span, limit: 100 },
          { kinds: [10000], authors: [account.pubkey], until: span.until, limit: 1 },
        ]);
        item.rounds.push({ purpose: 'text notifications, Home candidates and public mutes', responses: first });
        const events = unique(first.flatMap(response => response.events));
        const context = [account.followEvent, ...events.filter(event => event.kind === 10000)];
        const policies = { notifications: { query: { source: 'notifications', account: account.pubkey }, ...span },
          home: { query: { source: 'home', account: account.pubkey }, ...span } };
        const initial = native(events, context, policies);
        const foci = candidateFoci(events, initial.eligibility.home, initial.relationships ?? []);
        const second = foci.length && budget.remaining() ? await request(account.relays,
          foci.map(focus => ({ kinds: [1, 42], '#e': [focus], ...span, limit: 100 }))) : [];
        item.rounds.push({ purpose: 'independent focus references', responses: second });
        const all = unique([...events, ...second.flatMap(response => response.events)]);
        const queries = { ...policies, ...Object.fromEntries(foci.map((id, index) =>
          ['thread' + index, { query: { source: 'thread', account: account.pubkey, id }, ...span }])) };
        const checked = native(all, context, queries);
        item.native = checked;
        item.selection = historicalSelection(all, checked, foci, span);
        item.completedControlRoutes = [...first, ...second].filter(response => response.status === 'eose').length;
        item.selection.informative &&= item.completedControlRoutes > 0 && !budget.snapshot().exhausted;
        item.finishedAt = now();
        if (item.selection.informative) { chosen = item; break; }
      } catch (error) { item.error = String(error).slice(0, 300); item.finishedAt = now(); }
    }
  } catch (error) { report.errors.push(String(error).slice(0, 300)); }
  budget.remaining(); report.finishedAt = now(); report.budget = budget.snapshot();
  chosen ??= report.candidates.find(item => item.account.pubkey === primary?.pubkey);
  report.chosen = chosen?.account.pubkey ?? primary?.pubkey;
  report.selection = chosen?.selection ?? { span, informative: false,
    notifications: { ids: [], availability: 'unknown: bounded availability preflight did not finish' },
    thread: { availability: 'unknown: bounded availability preflight did not finish' } };
  report.selection = { ...report.selection, selectedBeforeApplication: true,
    status: report.budget.exhausted ? 'unknown: preflight evidence or deadline limit'
      : report.selection.informative ? 'informative historical workload selected' : 'uninformative historical workload; live hour remains independent' };
  report.selectedControls = chosen ? unique(chosen.rounds.flatMap(round => round.responses.flatMap(response => response.events))) : [];
  return { account: chosen?.account ?? primary, report };
}
