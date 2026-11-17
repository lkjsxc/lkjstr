import test from 'node:test';
import assert from 'node:assert/strict';
import { options, visitPlan, classifyVisit, ratio, summariseRepeat } from './cache-repeat-model.mjs';
import { repeatNetwork } from './cache-repeat-network.mjs';
import { domProbe } from './cache-repeat-dom-fixture.mjs';
test('short runs cannot be reported as an hour even if a stalled browser consumes an hour', () => {
  const report = { complete: true, requestedSeconds: 60, visits: [], traffic: {},
    phaseDurations: { first: 4000, repeat: 4000 } };
  assert.equal(summariseRepeat(report).completedHour, false);
  assert.equal(summariseRepeat(report).mode, 'short-calibration');
  assert.equal(summariseRepeat(report).cacheConfirmedShare, null);
});
test('an exact replay schedule totals one hour and ends on the same Home that will reload', () => {
  const plan = visitPlan(3600, 30);
  assert.equal(plan.length, 120);
  assert.equal(plan.reduce((sum, row) => sum + row.dwellSeconds, 0), 3600);
  assert.equal(plan.at(-1).kind, 'home');
  assert.equal(new Set(plan.map(row => row.kind)).size, 9);
  assert.deepEqual(structuredClone(plan), plan);
  assert.throws(() => options(['--seconds=3600', '--visit-seconds=1']), /480/);
  assert.throws(() => options(['--account=x', '--account=y']), /repeated/);
  assert.throws(() => options(['--network-route=other']), /network-route/);
});
test('missing denominators and unobserved screens never become zero-cost success', () => {
  assert.equal(ratio(0, 0), null);
  assert.equal(ratio(100, 9), 0.09);
  const fast = { expected: { keys: ['a'] }, dom: { cachedScreenMs: 32 },
    network: { cacheOrigin: 'relay-overlap' } };
  assert.equal(classifyVisit(fast).cacheConfirmedWithin100, false);
  assert.equal(classifyVisit({ ...fast, expected: { keys: [] } }).contentPreviouslyHeld, false);
  assert.equal(classifyVisit({ ...fast, network: { cacheOrigin: 'before-relay-event' } }).cacheConfirmedWithin100, true);
});
const event = (network, method, params, sessionId = 'worker', observedAt = 1000050) =>
  network.observe({ method: 'Network.' + method, params, sessionId, observedAt });
const frame = (id, timestamp, text) => ({ requestId: id, timestamp, response: { opcode: 1, payloadData: text } });
test('CDP handshake clocks detect an EVENT before paint despite delayed host observation', () => {
  const network = repeatNetwork(); network.beginPhase('first'); network.beginVisit('one');
  event(network, 'webSocketWillSendHandshakeRequest', { requestId: 'a', timestamp: 10, wallTime: 1000 });
  const payload = JSON.stringify(['EVENT', 's', { id: 'b'.repeat(64), content: 'public fixture' }]);
  event(network, 'webSocketFrameReceived', frame('a', 10.02, payload), 'worker', 1000090);
  const result = network.endVisit(1000000, 1000100, 1000030);
  assert.equal(result.eventsBeforePaint, 1);
  assert.equal(result.cacheOrigin, 'relay-overlap');
  assert.equal(result.receivedBytes, Buffer.byteLength(payload));
  assert.equal(JSON.stringify(result).includes('public fixture'), false);
});
test('missing clock or malformed input cannot prove independent cached paint', () => {
  const network = repeatNetwork(); network.beginPhase('first'); network.beginVisit('one');
  event(network, 'webSocketFrameReceived', frame('no-clock', 3, '["EOSE","x"]'), 'worker', 1000020);
  assert.equal(network.endVisit(1000000, 1000100, 1000030).cacheOrigin, 'unknown');
  network.beginVisit('two');
  event(network, 'webSocketFrameReceived', frame('bad', 3, 'broken'), 'worker', 1000020);
  assert.equal(network.endVisit(1000000, 1000100, 1000030).cacheOrigin, 'unknown');
});
test('traffic is phase-wide, target IDs do not collide, and repeat ratios retain actual bytes', () => {
  const network = repeatNetwork(); network.beginPhase('first');
  for (const session of ['page', 'worker']) event(network, 'requestWillBeSent', { requestId: 'same' }, session);
  event(network, 'loadingFinished', { requestId: 'same', encodedDataLength: 30 }, 'page');
  event(network, 'loadingFinished', { requestId: 'same', encodedDataLength: 70 }, 'worker');
  event(network, 'webSocketFrameReceived', frame('w', 3, '["EVENT","x",{}]'));
  network.beginPhase('repeat');
  event(network, 'webSocketFrameReceived', frame('w', 4, '["EOSE","x"]'));
  const result = network.summary();
  assert.equal(result.phases.first.httpBytes, 100);
  assert.equal(result.phases.first.events, 1);
  assert.equal(result.phases.repeat.events, 0);
  assert.equal(result.phases.repeat.receivedBytes, Buffer.byteLength('["EOSE","x"]'));
});

test('held screen requires a subsequent frame and refuses a new head ahead of held rows', async () => {
  const dom = await domProbe({ expected: { keys: ['a', 'b'], authors: [] } });
  try {
    const extra = dom.add('new'); dom.add('a', undefined, 'Known author', 100); dom.add('b', undefined, 'Known author', 200);
    await dom.advance(16); await dom.advance(32);
    assert.equal(dom.value().cachedScreenMs, undefined);
    extra.row.remove(); await dom.advance(48);
    assert.equal(dom.value().cachedScreenMs, undefined);
    await dom.advance(64); assert.equal(dom.value().cachedScreenMs, 64);
  } finally { dom.close(); }
});
test('a previously loaded picture must load again before the held screen is credited', async () => {
  const pubkey = 'b'.repeat(64);
  const dom = await domProbe({ expected: { keys: ['a'], authors: [{ pubkey, named: true, image: true }] } });
  try {
    const row = dom.add('a'), image = dom.document.createElement('img'); row.face.append(image);
    let decode; image.decode = () => new Promise(resolve => { decode = resolve; });
    Object.defineProperty(image, 'complete', { value: false, configurable: true });
    Object.defineProperty(image, 'naturalWidth', { value: 0, configurable: true });
    await dom.advance(16); await dom.advance(32); assert.equal(dom.value().cachedScreenMs, undefined);
    Object.defineProperty(image, 'complete', { value: true });
    Object.defineProperty(image, 'naturalWidth', { value: 64 });
    image.dispatchEvent(new dom.window.Event('load')); await dom.advance(48); await dom.advance(64);
    assert.equal(dom.value().cachedScreenMs, undefined);
    decode(); await dom.advance(80); await dom.advance(96);
    assert.equal(dom.value().cachedScreenMs, 96);
  } finally { dom.close(); }
});
test('known-author raw-key spans survive until hydration and record a real regression', async () => {
  const pubkey = 'b'.repeat(64);
  const dom = await domProbe({ known: [{ pubkey, named: true }], expected: { keys: [], authors: [] } });
  try {
    const row = dom.add('a', pubkey, 'npub1abcdef…1234');
    await dom.advance(16); await dom.advance(160);
    row.button.textContent = 'Known author'; await dom.advance(180);
    assert.equal(dom.value().rawAuthorSpans.length, 1);
    assert.equal(dom.value().rawAuthorSpans[0].durationMs, 164);
    assert.equal(dom.value().rawAuthorSpans[0].namedBefore, true);
  } finally { dom.close(); }
});

test('optional stored-window marks require matching painted content and preserve the primary comparison', async () => {
  const dom = await domProbe({ expected: { keys: ['a'], authors: [] } });
  try {
    dom.mark({ source: 'profile', sub: 'other', rows: 1 }, 8);
    assert.equal(dom.value().publicCacheMark, null);
    dom.mark({ source: 'home', sub: 'one', rows: 1 }, 10);
    await dom.advance(16); await dom.advance(32);
    assert.equal(dom.value().publicCacheMark.painted, false);
    dom.add('a'); await dom.advance(48); await dom.advance(64);
    const result = classifyVisit({ expected: { keys: ['a'] }, dom: dom.value(),
      network: { cacheOrigin: 'relay-overlap' } });
    assert.equal(result.cacheConfirmedWithin100, false);
    assert.equal(result.cacheMarkedWithin100, true);
  } finally { dom.close(); }
});
test('a stored-window mark after the frame cannot claim provenance for that frame', async () => {
  const dom = await domProbe({ expected: { keys: ['a'], authors: [] } });
  try {
    dom.add('a'); await dom.advance(16); await dom.advance(32);
    dom.mark({ source: 'home', sub: 'one', rows: 1 }, 50);
    assert.equal(dom.value().publicCacheMark.painted, false);
  } finally { dom.close(); }
});

test('a clockless incoming frame observed after paint still prevents a cache-origin claim', () => {
  const network = repeatNetwork(); network.beginPhase('repeat'); network.beginVisit('late');
  event(network, 'webSocketFrameReceived', frame('no-clock', 3, '["EVENT","x",{}]'), 'worker', 1000150);
  assert.equal(network.endVisit(1000000, 1000100, 1000030).cacheOrigin, 'unknown');
});
test('notification actors match their own visible labels and auxiliary faces stay unlabeled', async () => {
  const keys = ['b', 'c', 'd'].map(value => value.repeat(64));
  const dom = await domProbe({ kind: 'notifications', known: keys.map(pubkey => ({ pubkey, named: true })),
    expected: { keys: ['n'], authors: keys.map((pubkey, index) => ({ pubkey, named: index < 2 })) } });
  try {
    const first = dom.add('n', keys[0], 'First'); first.row.className = 'notif';
    const faces = dom.document.createElement('div'); faces.className = 'nfaces'; first.row.append(faces); faces.append(first.face);
    for (let index = 1; index < 3; index++) {
      const face = dom.document.createElement('span'); face.dataset.face = keys[index]; faces.append(face);
    }
    const second = first.button.cloneNode(); second.title = 'npub1' + keys[1]; second.textContent = 'Second'; first.row.append(second);
    await dom.advance(16); await dom.advance(32);
    assert.equal(dom.value().cachedScreenMs, 32);
    const auxiliary = dom.value().screen.authors.find(person => person.pubkey === keys[2]);
    assert.equal(auxiliary.nameKnown, false); assert.equal(auxiliary.identityUnresolved, false);
    assert.equal(dom.value().known.find(person => person.pubkey === keys[1]).npub, 'npub1' + keys[1]);
    second.title = 'wrong identity';
    dom.window.__cacheRepeat.begin({ id: 'wrong', kind: 'notifications', expected: { keys: ['n'], authors: [{ pubkey: keys[1], named: true }] } });
    await dom.advance(48); await dom.advance(64);
    assert.equal(dom.value().cachedScreenMs, undefined);
  } finally { dom.close(); }
});
test('only the primary profile face may use its untitled heading', async () => {
  const pubkey = 'b'.repeat(64), auxiliaryKey = 'c'.repeat(64);
  const dom = await domProbe({ kind: 'profile', expected: { keys: ['p'], authors: [{ pubkey, named: true }] } });
  try {
    const row = dom.add('p'); row.row.className = 'profile'; row.button.remove();
    const head = dom.document.createElement('div'); head.className = 'phead'; head.append(row.face); row.row.append(head);
    const name = dom.document.createElement('h1'); name.className = 'pname'; name.textContent = 'Primary'; row.row.append(name);
    const group = dom.document.createElement('div'); group.className = 'known'; row.row.append(group);
    const face = dom.document.createElement('span'); face.dataset.face = auxiliaryKey; group.append(face);
    await dom.advance(16); await dom.advance(32);
    assert.equal(dom.value().cachedScreenMs, 32);
    assert.equal(dom.value().screen.authors.find(person => person.pubkey === auxiliaryKey).named, false);
  } finally { dom.close(); }
});
test('emoji-only names need decoded emoji and do not become raw-key regressions while decoding', async () => {
  const pubkey = 'b'.repeat(64);
  const dom = await domProbe({ known: [{ pubkey, named: true }], expected: { keys: ['a'], authors: [{ pubkey, named: true }] } });
  try {
    const row = dom.add('a'), emoji = dom.document.createElement('img'); emoji.className = 'emo'; emoji.alt = ':fixture:';
    row.button.replaceChildren(emoji);
    Object.defineProperty(emoji, 'complete', { value: true }); Object.defineProperty(emoji, 'naturalWidth', { value: 32 });
    let decode; emoji.decode = () => new Promise(resolve => { decode = resolve; });
    await dom.advance(16); await dom.advance(160);
    assert.equal(dom.value().cachedScreenMs, undefined); assert.equal(dom.value().rawAuthorSpans.length, 0);
    decode(); await dom.advance(180); await dom.advance(196);
    assert.equal(dom.value().cachedScreenMs, 196); assert.equal(dom.value().screen.authors[0].named, true);
  } finally { dom.close(); }
});
