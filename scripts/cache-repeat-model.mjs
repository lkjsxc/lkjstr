// Deterministic visit schedules and conservative cache evidence classification.
export const visitKinds = ['home', 'thread', 'profile', 'notifications', 'bookmarks',
  'following', 'followers', 'search', 'relays'];
export function options(args) {
  const names = new Set(['build', 'output', 'seconds', 'visit-seconds', 'account', 'search', 'network-route', 'schema']);
  const values = {};
  for (const arg of args) {
    const match = /^--([a-z-]+)=(.+)$/.exec(arg);
    if (!match || !names.has(match[1]) || match[1] in values) throw Error('Unknown or repeated option: ' + arg);
    values[match[1]] = match[2];
  }
  const seconds = Number(values.seconds ?? 3600), visitSeconds = Number(values['visit-seconds'] ?? 30);
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > 7200) throw Error('seconds must be 1..7200');
  if (!Number.isInteger(visitSeconds) || visitSeconds < 1 || visitSeconds > 120) throw Error('visit-seconds must be 1..120');
  if (Math.ceil(seconds / visitSeconds) > 480) throw Error('At most 480 recorded visits per phase');
  const route = values['network-route'] ?? 'workspace';
  if (!['workspace', 'host'].includes(route)) throw Error('network-route must be workspace or host');
  const schema = Number(values.schema ?? 2);
  if (![1, 2].includes(schema)) throw Error('schema must match the exact build: 1 or 2');
  const search = values.search ?? 'nostr';
  if (search.length > 200 || !search.trim()) throw Error('search must contain 1..200 characters');
  return { seconds, visitSeconds, route, schema, search, build: values.build ?? 'dist',
    account: values.account, output: values.output };
}
export function visitPlan(seconds, visitSeconds) {
  const result = [];
  for (let offset = 0; offset < seconds; offset += visitSeconds) {
    const index = result.length, kind = visitKinds[index % visitKinds.length];
    result.push({ id: 'visit-' + index, kind, offsetSeconds: offset,
      dwellSeconds: Math.min(visitSeconds, seconds - offset),
      scroll: ['home', 'profile', 'notifications', 'bookmarks', 'thread', 'search'].includes(kind) });
  }
  if (result.length) Object.assign(result.at(-1), { kind: 'home', scroll: true });
  return result;
}
export function classifyVisit(row) {
  const cached = Number.isFinite(row.dom?.cachedScreenMs);
  const known = (row.expected?.keys?.length ?? 0) > 0;
  const painted = cached && row.dom.cachedScreenMs <= 100 && !row.unavailable && !row.dom.dropped;
  return { contentPreviouslyHeld: known, cachedPaintWithin100: known && painted,
    cacheConfirmedWithin100: known && painted && row.network?.cacheOrigin === 'before-relay-event',
    cacheMarkedWithin100: known && painted && row.dom?.publicCacheMark?.painted === true,
    status: row.unavailable ? 'unavailable' : !known ? 'content-not-established'
      : row.dom?.dropped ? 'observer-overflow' : !cached ? 'held-screen-not-painted' : !painted ? 'over-100ms'
      : row.network?.cacheOrigin !== 'before-relay-event' ? 'origin-unproven' : 'cache-confirmed' };
}
export const ratio = (first, repeat) => Number.isFinite(first) && first > 0 && Number.isFinite(repeat) ? repeat / first : null;
export function summariseRepeat(report) {
  const visits = report.visits.filter(row => row.phase === 'repeat'), held = visits.filter(row => row.result?.contentPreviouslyHeld);
  const first = report.traffic?.phases?.first ?? {}, second = report.traffic?.phases?.repeat ?? {};
  const raw = visits.flatMap(row => row.dom?.rawAuthorSpans ?? []).filter(row => row.namedBefore && row.durationMs > 100);
  return { mode: report.requestedSeconds >= 3600 ? 'hour-protocol' : 'short-calibration',
    completedHour: report.complete === true && report.requestedSeconds >= 3600 &&
      ['first', 'repeat'].every(phase => report.phaseDurations?.[phase] >= 3600),
    repeatVisits: visits.length, previouslyHeldVisits: held.length,
    cachedPaintWithin100: held.filter(row => row.result.cachedPaintWithin100).length,
    cacheConfirmedWithin100: held.filter(row => row.result.cacheConfirmedWithin100).length,
    cacheMarkedWithin100: held.filter(row => row.result.cacheMarkedWithin100).length,
    cacheReplayMarkObserved: report.visits.some(row => row.dom?.cacheMarksObserved),
    cacheConfirmedShare: held.length ? held.filter(row => row.result.cacheConfirmedWithin100).length / held.length : null,
    secondToFirstEvents: ratio(first.events, second.events),
    secondToFirstWebSocketBytes: ratio(first.receivedBytes, second.receivedBytes),
    knownAuthorRawOver100: raw.length, rawAuthorSpans: raw,
    missingKinds: visitKinds.filter(kind => !visits.some(row => row.kind === kind && !row.unavailable)),
    coverageGaps: report.coverageGaps ?? [] };
}
