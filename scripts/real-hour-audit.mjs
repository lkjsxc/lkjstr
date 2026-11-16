// Independent public controls use native eligibility over this fresh profile's public cache.
import { spawnSync } from 'node:child_process';
import { eventDigest } from './real-hour-network.mjs';
import { controlPages } from './real-hour-public.mjs';
import { sourceFilter, controlCoverage, evidenceStatus } from './real-hour-coverage.mjs';
import { readObservation, mergeObservations, observationFor, domStatus } from './real-hour-dom.mjs';
export async function publicContext(page) {
  return page.evaluate(async () => new Promise((resolve, reject) => {
    const open = indexedDB.open('lkjstr-wasm');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const request = db.transaction('events').objectStore('events').getAll(undefined, 20000);
      request.onerror = () => { db.close(); reject(request.error); };
      request.onsuccess = () => {
        const events = request.result.flatMap((row) => {
          try {
            const event = JSON.parse(row.raw);
            return Array.isArray(event) && event[0] === 1
              ? [{ id: event[1], pubkey: event[2], created_at: event[3], kind: event[4], tags: event[5], content: event[6], sig: event[7] }]
              : event?.id ? [event] : [];
          } catch { return []; }
        });
        db.close(); resolve(events);
      };
    };
  }));
}
export function nativeEligibility(events, context, queries, { timeoutMs, relationships = false, ordered = false } = {}) {
  const verify = spawnSync(process.env.LKJSTR_REAL_VERIFY ?? 'target/debug/examples/engine-public-verify', {
    input: JSON.stringify({ events, context, queries, relationships, ordered }), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    ...(timeoutMs === undefined ? {} : { timeout: Math.max(1, timeoutMs) }),
  });
  if (verify.status !== 0) throw Error(`Native eligibility failed: ${String(verify.error ?? verify.stderr).slice(0, 500)}`);
  const result = JSON.parse(verify.stdout);
  if (!result.eligibility) throw Error('Rebuild engine-public-verify: native eligibility mode is required');
  if (relationships && !Array.isArray(result.relationships)) throw Error('Rebuild engine-public-verify: relationship mode is required');
  if (ordered && Object.values(result.eligibility).some(policy => !Array.isArray(policy.ordered)))
    throw Error('Rebuild engine-public-verify: ordered query mode is required');
  return result;
}
export function sourceRoutes(queries, account) {
  const selected = (test) => [...new Set(queries.filter((q) => q.filters.some(test)).map((q) => q.relay))];
  return {
    home: selected((filter) => sourceFilter(filter, 'home', account)),
    notifications: selected((filter) => sourceFilter(filter, 'notifications', account)),
  };
}
export async function routeControls(relays, filter, cap) {
  const events = new Map(), seenOn = new Map(), firstSeenOn = new Map(), pages = [];
  for (const relay of relays) {
    const sample = await controlPages([relay], filter, cap);
    pages.push(...sample.pages);
    for (const event of sample.events) {
      if (!events.has(event.id) && events.size >= cap) continue;
      events.set(event.id, event);
      const routes = seenOn.get(event.id) ?? [];
      if (!routes.includes(relay)) routes.push(relay);
      seenOn.set(event.id, routes);
      const times = firstSeenOn.get(event.id) ?? {};
      times[relay] = sample.firstSeenAt[event.id];
      firstSeenOn.set(event.id, times);
    }
  }
  return { filter, pages, events: [...events.values()], seenOn: Object.fromEntries(seenOn), firstSeenOn: Object.fromEntries(firstSeenOn), capReached: events.size >= cap };
}
export async function auditControls({ page, cdp, account, controls, savedSeen, savedObservation, startedAt, endedAt }) {
  const targets = await cdp.sample();
  const querySnapshot = cdp.queryEvidence ? await cdp.queryEvidence()
    : { queries: await cdp.queries(), hostNetwork: cdp.networkEvidence?.summary() };
  const queries = querySnapshot.queries;
  const evidence = evidenceStatus(targets, querySnapshot.hostNetwork);
  const routes = sourceRoutes(queries.filter((query) => query.at <= endedAt), account);
  const context = await publicContext(page), cacheSampledAt = Date.now();
  const cached = new Map(context.map(event => [event.id, event]));
  const latest = (kind) => context.filter((event) => event.kind === kind && event.pubkey === account.pubkey)
    .sort((a, b) => b.created_at - a.created_at || a.id.localeCompare(b.id))[0];
  const follow = latest(3) ?? account.followEvent;
  const authors = [...new Set([...follow.tags.filter((tag) => tag[0] === 'p').map((tag) => tag[1]), account.pubkey])];
  const correction = [];
  const originalRoutes = [...new Set(controls.home.pages.map((entry) => entry.relay))];
  const primaryRoutes = routes.home;
  if (originalRoutes.some((relay) => !primaryRoutes.includes(relay))) {
    controls.homeRelayUnion = controls.home;
    controls.home = await routeControls(primaryRoutes, { ...controls.home.filter, authors }, 6000);
    correction.push({ reason: 'Separate actual Home-request relays from wider configured/outbox relay union', primaryRoutes, unionRoutes: originalRoutes });
  }
  const originalNotificationRoutes = [...new Set(controls.notifications.pages.map((entry) => entry.relay))];
  if (originalNotificationRoutes.some((relay) => !routes.notifications.includes(relay))) {
    controls.notificationsRelayUnion = controls.notifications;
    controls.notifications = await routeControls(routes.notifications, controls.notifications.filter, 3000);
    correction.push({ reason: 'Separate actual notification-request relays from wider relay union', primaryRoutes: routes.notifications, unionRoutes: originalNotificationRoutes });
  }
  const omitted = authors.filter((author) => !controls.home.filter.authors?.includes(author));
  if (omitted.length) {
    const extra = await routeControls(routes.home,
      { ...controls.home.filter, authors: omitted }, 3000);
    controls.home.events = [...new Map([...controls.home.events, ...extra.events].map((event) => [event.id, event])).values()];
    controls.home.pages.push(...extra.pages.map((entry) => ({ ...entry, supplementalAuthors: omitted })));
    controls.home.filter.authors = authors;
    controls.home.seenOn = { ...(controls.home.seenOn ?? {}), ...extra.seenOn };
    controls.home.firstSeenOn = { ...(controls.home.firstSeenOn ?? {}), ...extra.firstSeenOn };
    correction.push({ reason: 'Include every actual Home author, including the account itself', authors: omitted, pages: extra.pages.length });
  }
  const views = await page.evaluate(() => globalThis.__realHour?.views ?? {});
  const wireQueries = Object.fromEntries(['home', 'notifications'].map((source) => [source, {
    query: views[source]?.query ?? { source, account: account.pubkey },
    since: Math.floor(startedAt / 1000), until: Math.floor(endedAt / 1000),
  }]));
  const all = [...controls.home.events, ...controls.notifications.events, ...(controls.homeRelayUnion?.events ?? []), ...(controls.notificationsRelayUnion?.events ?? [])];
  const native = nativeEligibility(all, context, wireQueries);
  const currentSeen = await page.evaluate(() => globalThis.__realHour?.seen ?? {});
  const seen = Object.fromEntries(['home', 'notifications'].map((source) =>
    [source, [...new Set([...(savedSeen?.[source] ?? []), ...(currentSeen[source] ?? [])])]]));
  const observation = mergeObservations(savedObservation, await readObservation(page));
  const compare = (source, sample = controls[source]) => {
    const policy = native.eligibility[source];
    const ids = new Set(sample.events.map((event) => event.id));
    const eligible = sample.events.filter((event) => policy.eligible.includes(event.id));
    const membership = event => observationFor(observation, source, event.id, endedAt);
    const displayed = new Set(Object.keys(observation.dom.first[source]));
    const domEvidence = domStatus(observation.dom, source);
    const coverage = controlCoverage({ events: eligible, sample, queries, source, account, startedAt, endedAt });
    const byId = new Map(coverage.events.map((entry) => [entry.id, entry]));
    const missing = eligible.filter(event => !membership(event).domByCutoff);
    const delivery = (event) => {
      const received = cdp.networkEvidence?.forEvent(event.id) ?? [];
      const matching = received.filter(item => item.digest === eventDigest(event));
      const before = matching.filter(item => item.at <= endedAt);
      return { matchingPayloads: matching.length, conflictingPayloads: received.length - matching.length,
        receivedBeforeEnd: before.length, matchingSourceBeforeEnd: before.filter(item =>
          item.request.filters.some(filter => sourceFilter(filter, source, account))).length,
        queryReferences: received.slice(0, 100).map(({ request, ...item }) => item), truncated: received.length > 100,
        limit: 'Exact frame receipt is not verified store acceptance or rendering; host-observed times after the end can include observer delay.' };
    };
    const comparisonStatus = !eligible.length ? 'uninformative: no eligible control events'
      : !sample.pages.some(page => page.status === 'eose') ? 'unknown: no completed control route'
        : source === 'home' && follow.id !== account.followEvent.id ? 'unknown: follow membership changed during the interval' : domEvidence;
    return { controlEvents: ids.size, verifiedEligible: eligible.length, comparisonStatus, observedRows: displayed.size,
      observationKind: 'top-level source DOM membership', wireProjectedRows: seen[source].length,
      eligibleDomByLiveEnd: eligible.filter(event => membership(event).domByCutoff).length,
      eligibleDomDuringControlGrace: eligible.filter(event => membership(event).domDuringGrace).length,
      unseenAfterControlGrace: eligible.filter(event => !displayed.has(event.id)).map(event => event.id),
      excluded: policy.excluded.filter((entry) => ids.has(entry.id)),
      unseenEligible: missing.map((event) => ({ id: event.id, pubkey: event.pubkey, created_at: event.created_at,
        firstControlSeenOn: sample.firstSeenOn?.[event.id], attribution: byId.get(event.id), delivery: delivery(event),
        observation: membership(event), physicalCache: { sampledAt: cacheSampledAt,
          matchingVerifiedPayload: cached.has(event.id) && eventDigest(cached.get(event.id)) === eventDigest(event) } })),
      missingCandidates: missing.filter((event) => byId.get(event.id)?.classification === 'matching-query-with-eose')
        .map((event) => ({ id: event.id, pubkey: event.pubkey, created_at: event.created_at, relays: sample.seenOn?.[event.id], observation: membership(event) })),
      uncertainCandidates: missing.filter((event) => byId.get(event.id)?.classification !== 'matching-query-with-eose').map((event) => byId.get(event.id)),
      coverage,
      relayResults: sample.pages.map(({ relay, status, count, notices }) => ({ relay, status, count, notices })),
      interpretation: 'Missing means no observed top-level DOM membership by the live cutoff. Wire projection, cache presence and later DOM appearance are distinct. Fresh buffering or an anchored window still requires reproduction; EOSE is not universal completeness.' };
  };
  return { nativeEligibility: true, ...evidence,
    completeness: ['home','notifications'].some(source => domStatus(observation.dom,source).startsWith('unknown:'))
      ? 'unknown: captured DOM membership evidence is missing, limited or ambiguously attributed' : evidence.completeness, relays: [...new Set([...routes.home, ...routes.notifications])], sourceRoutes: routes,
    window: { since: Math.floor(startedAt / 1000), until: Math.floor(endedAt / 1000) },
    followEvent: follow.id, initialFollowEvent: account.followEvent.id, followsChanged: follow.id !== account.followEvent.id,
    authorCount: authors.length, publicMuteEvent: latest(10000)?.id, privateMutePolicy: 'Read-only npub cannot decrypt private list content',
    signatureVerification: { accepted: native.verified.length, rejected: native.rejected },
    nativeStore: { events: native.storeEvents, evictions: native.storeEvictions }, correction,
    home: compare('home'), notifications: compare('notifications'),
    ...(controls.homeRelayUnion ? { homeRelayUnion: { ...compare('home', controls.homeRelayUnion),
      interpretation: 'Supplemental acquisition-coverage comparison across all observed relays; a missing note here is not evidence of same-Home-relay loss.' } } : {}),
    ...(controls.notificationsRelayUnion ? { notificationsRelayUnion: { ...compare('notifications', controls.notificationsRelayUnion),
      interpretation: 'Supplemental relay-union coverage only; not same-notification-relay loss.' } } : {}),
    notificationScope: 'kind-1 mentions/replies only; grouped reaction/repost/zap constituent IDs are not exposed',
    homeScope: 'direct kind-1 notes only; repost wrapper membership is not counted',
    timing: 'Same event-time window; primary DOM comparison stops at the live-hour cutoff. First DOM appearances during control grace are retained separately; neither proves viewport visibility or compositor paint.',
    observation, liveCutoff: endedAt,
    cutoffViewIntent: { capturedAt: savedObservation?.capturedAt, views: savedObservation?.views, dom: savedObservation?.dom?.sources },
    bufferingLimit: 'A Fresh count or non-top requested anchor can deliberately buffer new rows. No extra Fresh control is clicked after the live cutoff; an unseen candidate is not automatically engine loss.',
    routeLifetimeLimit: 'Closed REQ lifetimes do not prove fulfilled Home intent. Every unseen eligible note remains a coverage candidate; route ownership and delivered EVENT loss require separate investigation',
    actualSourceRequestsObserved: { home: routes.home.length > 0, notifications: routes.notifications.length > 0 },
    querySource: views.home?.query ? 'observed wire query' : 'fresh harness default Home/notifications queries; no filter controls changed',
    querySnapshotAt: querySnapshot.at, queries, controls, seen };
}
