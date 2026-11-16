// Pure measurement-policy regressions. Synthetic metadata here is not signature evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { controlBudget } from './real-hour-budget.mjs';
import { candidateFoci, historicalSelection } from './real-hour-history-select.mjs';
import { compareHistorical } from './real-hour-history-compare.mjs';
import { preflightHistorical } from './real-hour-history-preflight.mjs';
import { eventDigest } from './real-hour-network.mjs';
import { historyDeadline } from './real-hour-history-dom.mjs';
const id = n => n.toString(16).padStart(64, '0');
const account = { pubkey: id(90), follows: [id(91)] };
const event = (n, extra = {}) => ({ id: id(n), pubkey: id(91), created_at: 150, kind: 1,
  tags: [['p', account.pubkey]], content: 'synthetic measurement policy', sig: '0'.repeat(128), ...extra });
const span = { since: 100, until: 200 }, startedAt = 1000000, cutoff = 1001000;
function basis(note = event(2)) {
  const query = { relay: 'ws://owned.test/a', at: startedAt - 10, subscription: 'n',
    filters: [{ kinds: [1, 42, 6, 16, 7, 9735], '#p': [account.pubkey], ...span }], eoseAt: startedAt + 5 };
  return { source: 'notifications', account, plan: { ids: [note.id], minimum: 1 }, span,
    control: { events: [note], seenOn: { [note.id]: [query.relay] }, firstSeenOn: { [note.id]: { [query.relay]: cutoff + 20 } },
      responses: [{ status: 'eose', relay: query.relay }], budget: { exhausted: false } },
    native: { eligibility: { notifications: { eligible: [note.id], excluded: [], ordered: [id(1), note.id, id(3)] } } },
    beforeCache: [], afterCache: [note], cutoff, queries: [query],
    exercise: { startedAt, finishedAt: cutoff, unknown: [], limitReached: false, domFirst: { [note.id]: startedAt + 500 },
      snapshots: [{ unknown: [], ids: [id(1), note.id, id(3)], window: { anchor: 'top', before: 0, after: 60 } }] },
    receipts: key => key === note.id ? [{ digest: eventDigest(note), at: startedAt + 300, relay: query.relay, request: query }] : [] };
}
test('aggregate UTF-8 bytes count duplicate control frames and stop all active requests', () => {
  const budget = controlBudget({ bytes: 5, frameBytes: 5 });
  let closed = 0;
  const releases = Array.from({ length: 3 }, () => budget.listen(() => closed++));
  assert.equal(budget.frame('é'), true); assert.equal(budget.frame('é'), true);
  assert.equal(budget.event(id(1)), true); assert.equal(budget.event(id(1)), true);
  assert.equal(budget.frame('é'), false);
  assert.equal(closed, 3);
  assert.equal(budget.snapshot().admittedBytes, 4);
  assert.equal(budget.snapshot().receivedBytes, 6);
  assert.equal(budget.snapshot().distinctEvents, 1);
  assert.equal(budget.snapshot().reason, 'aggregate-byte-limit');
  releases.forEach(release => release()); assert.equal(budget.snapshot().activeRequests, 0);
});
test('event, single-frame, total-frame and deadline bounds remain explicit', () => {
  const events = controlBudget({ events: 1 }); events.event(id(1)); events.event(id(2));
  assert.equal(events.snapshot().reason, 'aggregate-event-limit');
  const frame = controlBudget({ frameBytes: 2 }); frame.frame('abc');
  assert.equal(frame.snapshot().reason, 'single-frame-byte-limit');
  const frames = controlBudget({ frames: 1 }); frames.frame('a'); frames.frame('b');
  assert.equal(frames.snapshot().reason, 'aggregate-frame-limit');
  let now = 100; const deadline = controlBudget({ milliseconds: 90, now: () => now });
  now = 190; assert.equal(deadline.remaining(), 0); assert.equal(deadline.snapshot().reason, 'deadline');
});
test('independent native relationships choose at most three eligible Home foci', () => {
  const notes = [event(1), event(2), event(3), event(4), event(5, { kind: 7 })];
  const foci = candidateFoci(notes, { eligible: notes.map(note => note.id) },
    [{ id: id(2), parent: id(1) }, { id: id(3), parent: id(1) }]);
  assert.deepEqual(foci, [id(1), id(2), id(3)]);
  assert.equal(candidateFoci(notes, { eligible: [] }, []).length, 0);
});
test('historical minimum requires text notifications and native direct replies', () => {
  const notes = [event(1), event(2), event(3), event(4), event(5, { kind: 7 })];
  const native = { eligibility: { notifications: { eligible: [id(2), id(3), id(4), id(5)] },
    thread0: { eligible: [id(1), id(2), id(3), id(4)] } },
    relationships: [{ id: id(2), parent: id(1) }, { id: id(3), parent: id(1) }, { id: id(4), parent: null }] };
  const selection = historicalSelection(notes, native, [id(1)], span);
  assert.equal(selection.informative, true); assert.deepEqual(selection.thread.ids, [id(2), id(3)]);
  assert.equal(selection.notifications.ids.includes(id(5)), false);
  native.relationships[1].parent = null;
  assert.equal(historicalSelection(notes, native, [id(1)], span).informative, false);
});
test('positive historical witness requires actual source route and scoped DOM membership', () => {
  const result = compareHistorical(basis());
  assert.equal(result.domObserved, 1); assert.equal(result.networkAndDomObserved, 1);
  assert.equal(result.outcomes[0].rangeExercised, true);
  assert.match(result.scope, /does not establish live-hour/);
});
test('wire receipt and physical cache without direct source DOM never pass', () => {
  const value = basis(); value.beforeCache = value.control.events; value.exercise.domFirst = {};
  value.exercise.snapshots[0].ids = [id(1), id(3)];
  const result = compareHistorical(value);
  assert.equal(result.domObserved, 0); assert.equal(result.networkAndDomObserved, 0);
  assert.match(result.outcomes[0].classification, /^cache-only/);
});
test('a prior cached note with real DOM membership stays separate from new acquisition', () => {
  const value = basis(); value.beforeCache = value.control.events;
  const result = compareHistorical(value);
  assert.equal(result.domObserved, 1); assert.equal(result.cachedAndDomObserved, 1);
  assert.equal(result.networkAndDomObserved, 0);
});
test('wrong source scope and quoted or out-of-window IDs cannot become success', () => {
  const wrong = basis(); wrong.exercise.unknown = ['source query changed'];
  assert.equal(compareHistorical(wrong).domObserved, 0);
  const outside = basis(); outside.exercise.domFirst = {}; outside.exercise.snapshots[0].ids = [id(1)];
  assert.equal(compareHistorical(outside).domObserved, 0);
  assert.match(compareHistorical(outside).outcomes[0].classification, /outside exercised/);
  const otherRoute = basis(); otherRoute.control.seenOn[id(2)] = ['ws://owned.test/other'];
  assert.equal(compareHistorical(otherRoute).domObserved, 0);
});
test('group constituents and outside-span events are explicitly excluded', () => {
  assert.match(compareHistorical(basis(event(2, { kind: 7 }))).outcomes[0].classification, /grouped/);
  assert.equal(compareHistorical(basis(event(2, { kind: 9735 }))).domObserved, 0);
  assert.match(compareHistorical(basis(event(2, { created_at: 99 }))).outcomes[0].classification, /outside fixed/);
});
test('missing native membership, zero controls and a budget cap cannot pass', () => {
  const hidden = basis(); hidden.native.eligibility.notifications.eligible = [];
  assert.equal(compareHistorical(hidden).domObserved, 0);
  assert.match(compareHistorical(hidden).status, /^uninformative/);
  const empty = basis(); empty.control.events = [];
  assert.match(compareHistorical(empty).status, /^uninformative/);
  const limited = basis(); limited.control.budget.exhausted = true;
  assert.match(compareHistorical(limited).status, /^unknown/);
  assert.equal(compareHistorical(limited).domObserved, 0);
});
function preflightStub({ informative = true, candidates = 4, requested, cost = 0 } = {}) {
  let clock = 1000000000, queries = 0, verifies = 0;
  const accounts = Array.from({ length: candidates }, (_, n) => ({ pubkey: id(90 + n), follows: [id(91)],
    followEvent: event(90 + n, { kind: 3 }), relays: ['ws://owned.test/a', 'ws://owned.test/b', 'ws://owned.test/c'] }));
  const notes = [event(1), event(2), event(3), event(4)];
  return { calls: () => ({ queries, verifies }), run: () => preflightHistorical({
    relays: [...accounts[0].relays, 'ws://unused.test/'], requested, now: () => clock,
    discover: async (relays, target, options) => { assert.equal(relays.length, 3); assert.ok(options.budget); return { ...accounts[0], candidates: accounts }; },
    query: async (relay, filters, timeout, options) => {
      queries++; clock += cost; options.budget.frame(JSON.stringify(notes));
      return { relay, filters, status: options.budget.remaining() ? 'eose' : 'budget', events: notes, firstSeenAt: {} };
    },
    verify: (events, context, queries, options) => {
      verifies++; assert.ok(options.relationships); assert.ok(options.timeoutMs > 0);
      return { verified: notes.map(note => note.id), rejected: 0,
        relationships: [{ id: id(2), parent: id(1) }, { id: id(3), parent: id(1) }],
        eligibility: Object.fromEntries(Object.keys(queries).map(name => [name, { eligible: informative ? (name === 'home' ? [id(1)] : [id(2), id(3), id(4)]) : [], excluded: [] }])) };
    },
  }) };
}
test('preflight prefers the original informative account before any app exists', async () => {
  const fixture = preflightStub(); const result = await fixture.run();
  assert.equal(result.account.pubkey, id(90)); assert.equal(result.report.candidates.length, 1);
  assert.equal(result.report.selection.selectedBeforeApplication, true);
  assert.equal(result.report.selection.informative, true);
  assert.deepEqual(fixture.calls(), { queries: 6, verifies: 2 });
});
test('uninformative selection never exceeds three candidates or replaces an explicit account', async () => {
  const all = preflightStub({ informative: false });
  assert.equal((await all.run()).report.candidates.length, 3);
  const explicit = preflightStub({ informative: false, requested: id(90) });
  assert.equal((await explicit.run()).report.candidates.length, 1);
});
test('deadline exhaustion stays unknown and retains the original account', async () => {
  const fixture = preflightStub({ cost: 31000 }); const result = await fixture.run();
  assert.equal(result.account.pubkey, id(90)); assert.equal(result.report.budget.reason, 'deadline');
  assert.match(result.report.selection.status, /^unknown/);
  assert.equal(result.report.candidates.length, 1);
});

test('an expired browser deadline never invokes its queued action thunk', async () => {
  let invoked = false;
  await assert.rejects(historyDeadline(() => { invoked = true; }, Date.now() - 1), /deadline/);
  assert.equal(invoked, false);
});
test('an unanswered browser RPC is bounded and carries the same absolute expiry', async () => {
  const deadline = Date.now() + 10; let expiry;
  await assert.rejects(historyDeadline(value => { expiry = value; return new Promise(() => {}); }, deadline), /deadline/);
  assert.ok(expiry <= deadline);
});
