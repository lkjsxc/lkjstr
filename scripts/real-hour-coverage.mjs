// Measurement attribution only. Native code remains responsible for eligibility.
import { domStatus } from './real-hour-dom.mjs';
const kinds = (filter, expected) => filter.kinds?.length === expected.length && expected.every((kind) => filter.kinds.includes(kind));
export function sourceFilter(filter, source, account, focus) {
  if (source === 'home') return kinds(filter, [1, 6]) && !filter['#e'] && !filter['#p']
    && filter.authors?.some((author) => author === account.pubkey || account.follows.includes(author));
  if (source === 'notifications') return kinds(filter, [1, 42, 6, 16, 7, 9735])
    && filter['#p']?.length === 1 && filter['#p'][0] === account.pubkey;
  return source === 'thread' && kinds(filter, [1, 42]) && filter['#e']?.length === 1 && filter['#e'][0] === focus;
}
export function matches(event, filter) {
  return (!filter.ids || filter.ids.some((id) => event.id.startsWith(id)))
    && (!filter.authors || filter.authors.some((author) => event.pubkey.startsWith(author)))
    && (!filter.kinds || filter.kinds.includes(event.kind))
    && (filter.since === undefined || event.created_at >= filter.since)
    && (filter.until === undefined || event.created_at <= filter.until)
    && Object.entries(filter).filter(([key]) => key.startsWith('#')).every(([key, values]) =>
      event.tags.some((tag) => tag[0] === key.slice(1) && values.includes(tag[1])));
}
export function controlCoverage({ events, sample, queries, source, account, focus, startedAt, endedAt }) {
  const relevant = queries.filter((query) => query.at <= endedAt && query.filters.some((filter) => sourceFilter(filter, source, account, focus)));
  const returnedRoutes = [...new Set(sample.pages.filter((page) => page.count > 0).map((page) => page.relay))];
  const classify = (event) => {
    const relays = sample.seenOn?.[event.id] ?? (returnedRoutes.length === 1 ? returnedRoutes : []);
    if (!relays.length) return { id: event.id, classification: 'control-relay-provenance-unavailable', relays };
    const exact = relevant.filter((query) => relays.includes(query.relay)
      && query.filters.some((filter) => sourceFilter(filter, source, account, focus) && matches(event, filter)));
    if (!exact.length) return { id: event.id, classification: 'outside-source-query', relays };
    const known = exact.filter((query) => typeof query.subscription === 'string');
    if (!known.length) return { id: event.id, classification: 'subscription-lifetime-not-recorded', relays };
    // Event seconds cannot establish delivery before an earlier millisecond boundary.
    const active = known.filter((query) => (query.closedAt ?? endedAt) >= Math.max(startedAt, event.created_at * 1000 + 999));
    const answered = active.filter((query) => query.eoseAt !== undefined && query.eoseAt <= endedAt);
    const classification = answered.length ? 'matching-query-with-eose'
      : active.length ? 'matching-query-without-eose' : 'route-ended-before-event';
    return { id: event.id, classification, relays, queryCount: exact.length };
  };
  const routes = [...new Set(relevant.map((query) => query.relay))].map((relay) => {
    const requests = relevant.filter((query) => query.relay === relay);
    const completed = requests.filter((query) => query.eoseAt !== undefined);
    return { relay, requests: requests.length, firstRequest: Math.min(...requests.map((q) => q.at)),
      lastRequest: Math.max(...requests.map((q) => q.at)), eose: completed.length,
      lifetimeRecorded: requests.every((q) => typeof q.subscription === 'string'),
      eoseLatencyMs: completed.map((q) => q.eoseAt - q.at) };
  });
  return { routes, events: events.map(classify),
    limit: 'EOSE/lifetime/filter agreement narrows candidates; it does not prove when a backdated note first reached the relay.' };
}

export function evidenceStatus(targets, hostNetwork, domSources = ['home', 'notifications']) {
  const relevant = targets.filter((target) => ['page', 'worker', 'shared_worker'].includes(target.type));
  const evidenceDrops = relevant.map(({ type, probe }) => ({ type, queries: probe?.queryLogDropped ?? 0,
    observations: probe?.evidenceDropped ?? {}, idsBySource: probe?.seenDropped ?? {} }));
  const queryEvidenceDropped = evidenceDrops.reduce((sum, item) => sum + item.queries, 0);
  const observationEvidenceDropped = evidenceDrops.reduce((sum, item) => sum + Object.values(item.observations).reduce((a, b) => a + b, 0), 0);
  const unobserved = !relevant.length || relevant.some((target) => !target.probe?.evidenceDropped);
  const limitReached = relevant.some(({ probe }) => Object.values(probe?.seenCounts ?? {}).some((count) => count >= 40000));
  const pages = relevant.filter(target => target.type === 'page');
  const domEvidence = domSources.map(source => ({ source, pages: pages.map(target => ({
    status: domStatus(target.probe?.dom, source), evidence: target.probe?.dom?.sources?.[source] })) }));
  const domUnknown = !pages.length || domEvidence.some(item => !item.pages.length || item.pages.some(page => page.status.startsWith('unknown:')));
  return { queryEvidenceDropped, observationEvidenceDropped, evidenceDrops, domEvidence,
    queryEvidenceSource: hostNetwork?.complete ? "host-CDP" : "Worker probe", hostNetwork,
    completeness: domUnknown ? 'unknown: DOM membership evidence unavailable, limited or ambiguously attributed'
      : unobserved ? 'unknown: observation counters unavailable'
      : (queryEvidenceDropped && !hostNetwork?.complete) || observationEvidenceDropped || limitReached ? 'unknown: bounded observation evidence budget reached'
        : 'scoped candidates only; no global relay completeness claim' };
}
