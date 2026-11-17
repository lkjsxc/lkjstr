// Pure fixture topology/relay tests. Stub IDs/signatures are not native validation evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { buildActsData } from './engine-acts-data.mjs';
import { actsRelay, matchesActFilter } from './engine-acts-relay.mjs';
import { actsBoot, actsLnurl } from './engine-acts-boot.mjs';
const pubkey = byte => byte.toString(16).padStart(2, '0').repeat(32);
const event = (author, kind, content, tags, at) => {
  const value = { pubkey: pubkey(author), kind, content, tags, created_at: at };
  return { ...value, id: createHash('sha256').update(JSON.stringify(value)).digest('hex'), sig: '0'.repeat(128) };
};
const seed = { recipient: pubkey(2), provider: pubkey(4), metadata: event(2, 0,
  JSON.stringify({ name: 'stub recipient', lud16: 'receiver@zap.fixture.invalid' }), [], 1800000000) };
const rpc = async value => {
  if (value.op === 'event') return event(value.author, value.kind, value.content, value.tags, value.at);
  if (value.op === 'invoice') {
    const request = JSON.parse(value.request);
    return { fixtureReceipt: event(4, 9735, '', [...request.tags.filter(tag => ['e', 'p'].includes(tag[0])),
      ['description', value.request], ['bolt11', 'stub-only-not-an-invoice']], value.at) };
  }
  if (value.op === 'duplicate') return event(value.provider, 9735, value.receipt.content, value.receipt.tags, value.at);
  throw Error('unexpected stub operation');
};
const data = await buildActsData({ rpc, seed, now: 1800000000 });
const last = value => value.tags.filter(tag => tag[0] === 'e').at(-1)?.[1];
const distance = start => {
  const catalog = new Map(data.catalog.map(value => [value.id, value])); let current = start, edges = 0;
  while ([6, 7, 16, 9735].includes(current.kind)) { current = catalog.get(last(current)); edges++; if (!current || edges > 8) break; }
  return { edges, terminal: current };
};
function socket() {
  const value = new EventEmitter(); value.readyState = 1; value.frames = [];
  value.send = raw => value.frames.push(JSON.parse(raw));
  value.close = value.terminate = () => { value.readyState = 3; value.emit('close'); };
  value.input = input => value.emit('message', Buffer.from(JSON.stringify(input)));
  return value;
}
const fixture = () => { const relay = actsRelay(data, () => 1000), ws = socket(); relay.connection(ws); return { relay, ws }; };
test('synthetic topology is bounded and names only fixture-owned signed-event slots', () => {
  assert.ok(data.catalog.length < 64); assert.ok(Buffer.byteLength(JSON.stringify(data)) < 2 * 1024 * 1024);
  assert.equal(new Set(data.catalog.map(value => value.id)).size, data.catalog.length);
  const known = new Set(data.catalog.map(value => value.id));
  for (const value of [...data.initial, ...Object.values(data.stages).flat()]) assert.ok(known.has(value.id));
});
test('primary cases exercise reaction/repost on both own act types and last-e precedence', () => {
  assert.equal(data.stages.primary.length, 5);
  assert.equal(data.reactionStar.tags.find(tag => tag[0] === 'e')[1], data.second.id);
  assert.equal(last(data.reactionStar), data.star.id); assert.equal(last(data.reactionRepost), data.repost.id);
  assert.equal(last(data.repostStar), data.star.id); assert.equal(last(data.repostRepost), data.repost.id);
  assert.equal(distance(data.reactionStar).terminal.id, data.base.id);
  assert.equal(distance(data.repostRepost).terminal.id, data.second.id);
});
test('newer direct acts intentionally compete with older preferred indirect representatives', () => {
  assert.ok(data.directNew.created_at > data.reactionStar.created_at);
  assert.ok(data.directSecondRepost.created_at > data.repostRepost.created_at);
  assert.equal(data.directNew.pubkey, data.reactionStar.pubkey);
});
test('four-edge and five-edge chains differ only by one extra act and reach the same note', () => {
  assert.equal(distance(data.fourEdges).edges, 4); assert.equal(distance(data.fiveEdges).edges, 5);
  assert.equal(distance(data.fourEdges).terminal.id, data.depthNote.id);
  assert.equal(distance(data.fiveEdges).terminal.id, data.depthNote.id);
});
test('missing, held and failed cases use separate terminal identities', () => {
  assert.equal(new Set([data.pendingNote.id, data.missingId, data.failedId]).size, 3);
  assert.equal(last(data.pendingAct), data.pendingNote.id); assert.equal(last(data.missingAct), data.missingId);
  assert.equal(last(data.failedAct), data.failedId);
});
test('a metadata terminal is unsupported and a receipt remains a traversable act link', () => {
  assert.equal(distance(data.unsupportedOuter).terminal.kind, 0);
  assert.equal(distance(data.zapTargetOuter).terminal.id, data.base.id);
  assert.equal(last(data.zap), data.star.id); assert.notEqual(data.zap.pubkey, data.untrustedZap.pubkey);
});
test('filter implementation respects authors, kinds, both time bounds and hashtag conjunction', () => {
  const value = data.reactionStar;
  assert.ok(matchesActFilter(value, { authors: [value.pubkey], kinds: [7], '#e': [data.star.id], '#p': [data.owner], since: value.created_at, until: value.created_at }));
  for (const filter of [{ authors: [data.owner] }, { kinds: [1] }, { '#e': [data.missingId] },
    { since: value.created_at + 1 }, { until: value.created_at - 1 }]) assert.equal(matchesActFilter(value, filter), false);
});
test('head queries see only activated fixtures, exact-id lookup can hydrate an intermediate act', () => {
  const { relay, ws } = fixture();
  ws.input(['REQ', 'head', { authors: [data.person], kinds: [7] }]);
  assert.equal(ws.frames.some(frame => frame[0] === 'EVENT' && frame[2].id === data.pendingOuter.id), false);
  ws.input(['REQ', 'id', { ids: [data.pendingAct.id] }]);
  assert.ok(ws.frames.some(frame => frame[0] === 'EVENT' && frame[1] === 'id' && frame[2].id === data.pendingAct.id));
  relay.add(data.stages.pending);
  assert.equal(ws.frames.filter(frame => frame[0] === 'EVENT' && frame[1] === 'head' && frame[2].id === data.pendingOuter.id).length, 1);
  relay.add(data.stages.pending);
  assert.equal(ws.frames.filter(frame => frame[0] === 'EVENT' && frame[1] === 'head' && frame[2].id === data.pendingOuter.id).length, 1);
  relay.close();
});
test('held note has no EOSE until explicit release and then arrives once before EOSE', () => {
  const { relay, ws } = fixture(); ws.input(['REQ', 'held', { ids: [data.pendingNote.id] }]);
  assert.deepEqual(ws.frames, []); relay.release(data.pendingNote.id);
  assert.deepEqual(ws.frames.map(frame => frame[0]), ['EVENT', 'EOSE']);
  assert.equal(ws.frames[0][2].id, data.pendingNote.id); assert.throws(() => relay.release(data.pendingNote.id)); relay.close();
});
test('completed empty and relay refusal produce distinct protocol endings', () => {
  const { relay, ws } = fixture(); ws.input(['REQ', 'missing', { ids: [data.missingId] }]);
  assert.deepEqual(ws.frames, [['EOSE', 'missing']]);
  ws.input(['REQ', 'failed', { ids: [data.failedId] }]);
  assert.equal(ws.frames.at(-1)[0], 'CLOSED'); assert.equal(relay.active, 1);
  assert.equal(relay.requests.at(-1).closeReason, 'relay-closed'); relay.close();
});
test('CLOSE and connection cleanup release subscriptions without invented new events', () => {
  const { relay, ws } = fixture(); ws.input(['REQ', 'a', { ids: [data.base.id] }]); ws.input(['CLOSE', 'a']);
  assert.equal(relay.active, 0); assert.equal(relay.requests[0].closeReason, 'client-close');
  relay.close(); assert.equal(relay.sockets, 0);
});
test('read-only relay rejects EVENT and AUTH', () => {
  for (const message of [['EVENT', data.base], ['AUTH', data.base]]) {
    const { relay, ws } = fixture(); ws.input(message); assert.equal(relay.forbidden, 1); assert.equal(ws.readyState, 3); relay.close();
  }
});
test('query, connection and input frame bounds fail explicitly', () => {
  const { relay, ws } = fixture();
  for (let index = 0; index <= 32; index++) ws.input(['REQ', 's' + index, { ids: [data.missingId] }]);
  assert.ok(relay.errors.includes('owned query evidence bound')); relay.close();
  const next = fixture(); next.ws.emit('message', Buffer.alloc(128 * 1024 + 1));
  assert.ok(next.relay.errors.includes('malformed or oversized owned frame')); next.relay.close();
  const capped = actsRelay(data);
  for (let index = 0; index < 9; index++) capped.connection(socket());
  assert.ok(capped.errors.includes('owned socket bound')); assert.equal(capped.sockets, 8); capped.close();
});
test('guard precedes production import and allows only the exact synthetic LNURL endpoint', () => {
  const body = actsBoot('/lkjstr_engine.js');
  assert.ok(body.indexOf('self.WebSocket=') < body.indexOf('await import('));
  assert.ok(body.indexOf('self.fetch=') < body.indexOf('await import('));
  assert.ok(body.includes(JSON.stringify(actsLnurl))); assert.ok(body.includes("['REQ','CLOSE']"));
  assert.equal(body.includes('zap.invoice'), false);
});
