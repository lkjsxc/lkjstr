// Historical selected-control evidence, deliberately separate from live-hour accounting.
import { eventDigest } from './real-hour-network.mjs';
import { sourceFilter, matches } from './real-hour-coverage.mjs';
export function exercisedRange(id, ordered, exercise) {
  if (exercise.domFirst[id] !== undefined) return true;
  const index = ordered.indexOf(id);
  if (index < 0) return false;
  const positions = new Map(ordered.map((key, at) => [key, at]));
  return exercise.snapshots.some(snapshot => {
    if (snapshot.unknown.length || !snapshot.window) return false;
    const indices = snapshot.ids.map(key => positions.get(key)).filter(at => at !== undefined);
    // Strict interior avoids pretending an unobserved timestamp/order boundary was exercised.
    return indices.length >= 2 && Math.min(...indices) < index && index < Math.max(...indices);
  });
}
export function compareHistorical({ source, account, plan, span, control, native, beforeCache,
  afterCache, exercise, queries, receipts = () => [], cutoff, acquisitionStartedAt = exercise.startedAt, evidenceUnknown = [] }) {
  const policy = native.eligibility[source], eligible = new Set(policy?.eligible ?? []);
  const events = new Map(control.events.map(event => [event.id, event]));
  const prior = new Map(beforeCache.map(event => [event.id, event]));
  const after = new Map(afterCache.map(event => [event.id, event]));
  const unknown = [...new Set([...exercise.unknown, ...evidenceUnknown])];
  if (control.budget?.exhausted) unknown.push('historical control evidence or deadline limit');
  if (!control.responses.some(response => response.status === 'eose')) unknown.push('no completed actual-source control route');
  if (exercise.limitReached) unknown.push('historical window/deadline bound reached');
  if (!Array.isArray(policy?.ordered)) unknown.push('native ordered query evidence unavailable');
  const outcomes = (plan.ids ?? []).slice(0, 20).map(id => {
    const event = events.get(id);
    if (!event) return { id, classification: 'unknown: selected control unavailable on actual source routes', domSuccess: false };
    if (![1, 42].includes(event.kind)) return { id, classification: 'excluded: grouped or unsupported notification kind', domSuccess: false };
    if (event.created_at < span.since || event.created_at > span.until)
      return { id, classification: 'excluded: outside fixed historical interval', domSuccess: false };
    if (!eligible.has(id)) return { id, classification: 'excluded: native source/mute/filter policy',
      reason: policy?.excluded?.find(item => item.id === id)?.reason, domSuccess: false };
    const relays = control.seenOn[id] ?? [];
    const sourceQueries = queries.filter(query => query.at <= cutoff && relays.includes(query.relay) &&
      query.filters.some(filter => sourceFilter(filter, source, account, plan.focus) && matches(event, filter)));
    const digest = eventDigest(event), first = exercise.domFirst[id];
    const domObserved = Number.isFinite(first) && first >= exercise.startedAt && first <= cutoff;
    const range = exercisedRange(id, policy.ordered ?? [], exercise);
    const cachedBefore = prior.has(id) && eventDigest(prior.get(id)) === digest;
    const cachedAfter = after.has(id) && eventDigest(after.get(id)) === digest;
    const received = receipts(id).filter(item => item.digest === digest && item.at <= cutoff &&
      item.request?.filters.some(filter => sourceFilter(filter, source, account, plan.focus) && matches(event, filter)));
    const during = received.filter(item => item.at >= acquisitionStartedAt);
    const attributed = sourceQueries.length > 0 && !unknown.length;
    const domSuccess = attributed && range && domObserved;
    const networkAndDom = domSuccess && !cachedBefore && during.length > 0;
    const classification = !attributed ? 'unknown: source/evidence attribution'
      : !range ? 'unknown: outside exercised historical window'
      : domSuccess ? (networkAndDom ? 'network receipt and source DOM observed' : cachedBefore ? 'cached note and source DOM observed' : 'source DOM observed; acquisition timing unknown')
      : cachedBefore ? 'cache-only: no source DOM observation'
      : received.length ? 'coverage candidate: received but no source DOM observation' : 'coverage candidate: available to control without source receipt';
    return { id, created_at: event.created_at, classification, domSuccess, networkAndDom,
      rangeExercised: range, cachedBefore, cachedAfter, firstDomObservedAt: first,
      actualControlRelays: relays, firstControlSeenOn: control.firstSeenOn[id],
      sourceQueryCount: sourceQueries.length, sourceQuerySummaryTruncated: sourceQueries.length > 100,
      matchingSourceQueries: sourceQueries.slice(0, 100).map(query => ({ relay: query.relay, at: query.at, subscription: query.subscription,
        filters: query.filters, eoseAt: query.eoseAt, closedAt: query.closedAt, closeReason: query.closeReason })),
      matchingReceipts: received.slice(0, 100).map(({ request, ...item }) => item), receiptLimit: received.length > 100 };
  });
  const eligibleSelected = outcomes.filter(item => item.created_at !== undefined).length;
  return { source, focus: plan.focus, span, planned: plan.ids ?? [], eligibleSelected, outcomes, unknown,
    status: unknown.length ? 'unknown: bounded historical evidence incomplete'
      : eligibleSelected < (plan.minimum ?? 1) ? 'uninformative: insufficient eligible controls on actual source routes'
      : 'informative selected historical witnesses',
    domObserved: outcomes.filter(item => item.domSuccess).length,
    networkAndDomObserved: outcomes.filter(item => item.networkAndDom).length,
    cachedAndDomObserved: outcomes.filter(item => item.domSuccess && item.cachedBefore).length,
    scope: 'Selected historical text-note membership only. Group constituents, nested quotes, unvisited ranges and cache-only presence never count as DOM success. This does not establish live-hour or all-relay completeness.' };
}
