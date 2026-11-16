import test from 'node:test';
import assert from 'node:assert/strict';
import { createNetworkEvidence, eventDigest } from './real-hour-network.mjs';
import { evidenceStatus } from './real-hour-coverage.mjs';
const bootstrap = { phase: 'imported', guardBeforeImport: true, hostReadyBeforeImport: true,
  releasedAt: 1, importedAt: 2 };
const event = { id: 'a'.repeat(64), pubkey: 'b'.repeat(64), created_at: 100, kind: 1,
  tags: [], content: 'body-not-retained', sig: 'c'.repeat(128) };
function fixture(limits) {
  const evidence = createNetworkEvidence(limits);
  evidence.target('worker', 'shared_worker', true);
  evidence.observeProbe('worker', { started: 1, sent: 0, received: 0 }, bootstrap);
  const receive = (method, params) => evidence.receive({ method: 'Network.webSocket' + method,
    sessionId: 'worker', params: { requestId: 'socket', ...params } }, 999999);
  receive('Created', { url: 'wss://fixture.invalid/' });
  receive('WillSendHandshakeRequest', { timestamp: 10, wallTime: 100 });
  const frame = (out, value, timestamp = 11) => receive(out ? 'FrameSent' : 'FrameReceived',
    { timestamp, response: { opcode: 1, payloadData: JSON.stringify(value) } });
  return { evidence, receive, frame };
}
test('off-page evidence joins exact request lifetimes and browser-time delivery without retaining bodies', () => {
  const { evidence, frame, receive } = fixture();
  frame(true, ['REQ', 'sub', { kinds: [1] }]);
  frame(false, ['EVENT', 'sub', event], 12);
  frame(false, ['EVENT', 'sub', event], 12.5);
  frame(false, ['EOSE', 'sub'], 13);
  frame(true, ['CLOSE', 'sub'], 14);
  frame(false, ['EVENT', 'sub', { ...event, content: 'conflicting-body' }], 15);
  receive('Closed', { timestamp: 16 });
  const snapshot = evidence.snapshot();
  assert.equal(snapshot.summary.complete, true);
  assert.equal(snapshot.queries[0].at, 101000);
  assert.equal(snapshot.queries[0].eoseAt, 103000);
  assert.equal(snapshot.queries[0].closedAt, 104000);
  assert.equal(snapshot.deliveries.length, 2);
  assert.equal(snapshot.deliveries[0].at, 102000);
  assert.equal(snapshot.deliveries[0].digest, eventDigest(event));
  assert.notEqual(snapshot.deliveries[1].digest, eventDigest(event));
  assert.equal(evidence.forEvent(event.id)[0].request.subscription, 'sub');
  assert.ok(!JSON.stringify(snapshot).includes(event.content));
  assert.ok(!JSON.stringify(snapshot).includes('conflicting-body'));
});
test('replacement, socket and target ownership do not alias subscription identifiers', () => {
  const { evidence, frame } = fixture();
  frame(true, ['REQ', 'same', { kinds: [1] }]);
  frame(true, ['REQ', 'same', { kinds: [6] }], 12);
  frame(false, ['EVENT', 'same', event], 13);
  evidence.target('page', 'page', true);
  evidence.observeProbe('page', { started: 1, sent: 0, received: 0 }, bootstrap);
  evidence.receive({ method: 'Network.webSocketCreated', sessionId: 'page',
    params: { requestId: 'socket', url: 'wss://second.invalid/' } });
  evidence.receive({ method: 'Network.webSocketFrameSent', sessionId: 'page', params: {
    requestId: 'socket', response: { opcode: 1, payloadData: JSON.stringify(['REQ', 'same', { kinds: [1] }]) } } }, 105000);
  evidence.detach('worker', 106000);
  assert.equal(evidence.queries()[0].closedAt, 102000);
  assert.equal(evidence.forEvent(event.id)[0].request.filters[0].kinds[0], 6);
  assert.equal(evidence.queries()[1].closeReason, 'target-detached');
  assert.equal(evidence.queries()[2].closedAt, undefined);
  assert.equal(evidence.summary().activeSockets, 1);
});
test('query, delivery, socket and byte caps remain explicit unknowns', () => {
  for (const limits of [{ queries: 0 }, { queryBytes: 1 }, { deliveries: 0 }, { deliveryBytes: 1 }, { sockets: 0 }]) {
    const { evidence, frame } = fixture(limits);
    frame(true, ['REQ', 'sub', { kinds: [1] }]);
    frame(false, ['EVENT', 'sub', event]);
    assert.equal(evidence.summary().complete, false);
    assert.ok(Object.values(evidence.summary().dropped).some(Boolean));
  }
});
test('missing target capture, malformed frames and forbidden outgoing frames cannot certify completeness', () => {
  for (const mode of ['missing', 'malformed', 'forbidden']) {
    const { evidence, receive, frame } = fixture();
    if (mode === 'missing') evidence.target('other', 'worker', false);
    if (mode === 'malformed') receive('FrameReceived', { response: { opcode: 1, payloadData: 'not json' } });
    if (mode === 'forbidden') frame(true, ['AUTH', {}]);
    assert.equal(evidence.summary().complete, false);
  }
});

test('a complete host record only replaces lost query evidence, never lost UI observations', () => {
  const target = { type: 'worker', probe: { queryLogDropped: 9,
    evidenceDropped: { ids: 0, views: 0, sourceMappings: 0 }, seenCounts: { home: 3 } } };
  assert.match(evidenceStatus([target], { complete: true }).completeness, /^unknown/);
  const page = { type: 'page', probe: { queryLogDropped: 0, evidenceDropped: { ids: 0, views: 0, sourceMappings: 0 },
    dom: { installed: true, sources: { home: { scopeSeen: true }, notifications: { scopeSeen: true } } } } };
  assert.match(evidenceStatus([target, page], { complete: true }).completeness, /^scoped/);
  assert.equal(evidenceStatus([target, page], { complete: true }).queryEvidenceDropped, 9);
  assert.match(evidenceStatus([target, page], { complete: false }).completeness, /^unknown/);
  target.probe.evidenceDropped.ids = 1;
  assert.match(evidenceStatus([target, page], { complete: true }).completeness, /^unknown/);
  const { evidence } = fixture();
  evidence.observeProbe('worker', { started: 1, sent: 1, received: 1 }, bootstrap);
  assert.equal(evidence.summary().complete, false);
});


test('unrecorded replacement requests never inherit the old source attribution', () => {
  for (const replacement of [['REQ', 'sub', { kinds: [7] }], ['REQ', 'sub', null]]) {
    const { evidence, frame } = fixture({ queries: 1 });
    frame(true, ['REQ', 'sub', { kinds: [1, 6], authors: ['b'.repeat(64)] }]);
    frame(true, replacement, 12);
    frame(false, ['EVENT', 'sub', event], 13);
    assert.deepEqual(evidence.forEvent(event.id), []);
    assert.equal(evidence.queries()[0].closedAt, 102000);
    assert.equal(evidence.summary().complete, false);
    assert.equal(evidence.summary().dropped.unattributed, 1);
  }
});

test('an unsampled or failed detached target cannot certify capture', () => {
  for (const failed of [false, true]) {
    const evidence = createNetworkEvidence();
    evidence.target('gone', 'worker', true);
    if (failed) {
      evidence.observeProbe('gone', { started: 1, sent: 0, received: 0 }, bootstrap);
      evidence.observeProbe('gone', undefined);
    }
    evidence.detach('gone');
    assert.equal(evidence.summary().complete, false);
  }
});
test('same-session navigation leaves lifetime certification unknown', () => {
  const { evidence, frame } = fixture();
  frame(true, ['REQ', 'sub', { kinds: [1] }]);
  evidence.observeProbe('worker', { started: 1, sent: 1, received: 0 }, bootstrap);
  assert.equal(evidence.summary().complete, true);
  evidence.observeProbe('worker', { started: 2, sent: 0, received: 0 }, bootstrap);
  assert.equal(evidence.summary().complete, false);
});

test('post-hoc Worker counters do not certify the original script startup boundary', () => {
  const evidence = createNetworkEvidence();
  evidence.target('worker', 'shared_worker', true);
  evidence.observeProbe('worker', { started: 1, sent: 0, received: 0 });
  assert.equal(evidence.summary().complete, false);
});
