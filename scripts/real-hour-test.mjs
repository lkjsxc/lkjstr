// The public harness must stop forbidden frames before they reach any socket.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createContext, runInContext } from 'node:vm';
import { observeRelease } from './real-hour-observe.mjs';
import { sourceFilter, controlCoverage, evidenceStatus } from './real-hour-coverage.mjs';
import { mergeObservations, observationFor, domStatus } from './real-hour-dom.mjs';
function setup() {
  const sent = [], posted = [];
  function Socket(url) { this.url = url; this.listeners = {}; this.readyState = 1; }
  Socket.prototype.send = function (raw) { sent.push(raw); };
  Socket.prototype.addEventListener = function (event, fn) { this.listeners[event] = fn; };
  Socket.prototype.close = function () { this.readyState = 3; this.listeners.close?.(); };
  function Port() {}
  Port.prototype.postMessage = (msg) => { posted.push(msg); };
  Object.defineProperty(Port.prototype, 'onmessage', { configurable: true,
    get() { return this.callback; }, set(fn) { this.callback = fn; } });
  const context = createContext({ WebSocket: Socket, MessagePort: Port, performance, DOMException });
  runInContext(`(${observeRelease.toString()})()`, context);
  return { context, sent, posted, run: (source) => runInContext(source, context) };
}
test('REQ/CLOSE guard rejects publishing, authentication and malformed frames before send', () => {
  const { run, sent } = setup();
  run('globalThis.socket = new WebSocket("wss://example.invalid"); socket.send(JSON.stringify(["REQ", "a", {kinds:[1]}]));');
  for (const type of ['EVENT', 'AUTH', 'COUNT']) assert.throws(() => run(`socket.send(JSON.stringify(["${type}", {}]));`), /read-only guard/);
  assert.throws(() => run('socket.send("not JSON")'), /malformed/);
  assert.equal(sent.length, 1);
  run('socket.send(JSON.stringify(["CLOSE", "a"]));');
  assert.equal(sent.length, 2);
  assert.equal(run('__realHourSnapshot().sockets[0].subscriptions'), 0);
  assert.equal(run('__realHour.forbidden'), 4);
});
test('network cut closes owned sockets and refuses new ones until resume', () => {
  const { run } = setup();
  run('new WebSocket("wss://example.invalid"); __realHourNetwork(false);');
  assert.equal(run('__realHourSnapshot().sockets.length'), 0);
  assert.throws(() => run('new WebSocket("wss://example.invalid")'), /Measured network outage/);
  run('__realHourNetwork(true); new WebSocket("wss://example.invalid");');
  assert.equal(run('__realHourSnapshot().sockets.length'), 1);
});
test('wire observation includes rows, inserts and updates; removal retains projection evidence', () => {
  const { run } = setup();
  run('globalThis.port = new MessagePort(); port.postMessage({t:"open",sub:"s1",query:{source:"home"}}); port.onmessage=()=>{};');
  run('port.onmessage({data:{t:"rows",sub:"s1",rows:[{kind:"note",id:"a",key:"a",author:{name:"Alice"}}]}});');
  run('port.onmessage({data:{t:"patch",sub:"s1",ops:[{op:"insert",before:null,rows:[{kind:"note",id:"b",key:"b"}]},{op:"update",row:{kind:"note",id:"c",key:"c"}},{op:"remove",key:"a"}]}});');
  assert.equal(run('JSON.stringify(__realHour.seen.home)'), '["a","b","c"]');
});

test('relay lifetimes and EOSE latency exclude a replaced or closed subscription', () => {
  const { run } = setup();
  run('globalThis.socket=new WebSocket("wss://example.invalid");socket.send(JSON.stringify(["REQ","a",{kinds:[1]}]));');
  run(`socket.listeners.message({data: '[ "EOSE", "a" ]'});`);
  assert.ok(run('__realHour.queries[0].eoseAt >= __realHour.queries[0].at'));
  run('socket.send(JSON.stringify(["REQ","a",{kinds:[1],until:10}]));');
  assert.equal(run('__realHour.queries[0].closeReason'), 'replaced');
  run(`socket.listeners.message({data: '["CLOSED","a","blocked"]'});`);
  assert.equal(run('__realHour.queries[1].closeReason'), 'relay-closed');
  assert.equal(run('socket.__hourQueries.size'), 0);
  assert.equal(run('__realHourSnapshot().sockets[0].subscriptions'), 0);
});

test('control attribution distinguishes count hydration and notes after a route closed', () => {
  const account = { pubkey: 'owner', follows: ['author'] };
  assert.equal(sourceFilter({ kinds: [1,6,7,9735], '#e': ['focus','other'] }, 'thread', account, 'focus'), false);
  assert.equal(sourceFilter({ kinds: [1,42], '#e': ['focus'] }, 'thread', account, 'focus'), true);
  const event = { id: 'note', pubkey: 'author', kind: 1, created_at: 2, tags: [] };
  const query = { at: 1000, eoseAt: 1100, closedAt: 1500, subscription: 's', relay: 'relay', filters: [{ kinds: [1,6], authors: ['author'] }] };
  const scope = { events: [event], sample: { pages: [{relay:'relay',count:1}] }, queries: [query], source: 'home', account, startedAt: 1000, endedAt: 10000 };
  assert.equal(controlCoverage(scope).events[0].classification, 'route-ended-before-event');
  assert.equal(controlCoverage({ ...scope, queries: [{ ...query, closedAt: 4000 }] }).events[0].classification, 'matching-query-with-eose');
});

test('query evidence shares repeated filters and stops retaining new payloads at its budget', () => {
  const { run } = setup();
  run('globalThis.socket=new WebSocket("wss://example.invalid");socket.send(JSON.stringify(["REQ","a",{kinds:[1]}]));socket.send(JSON.stringify(["REQ","a",{kinds:[1]}]));');
  assert.equal(run('__realHour.queries[0].filters === __realHour.queries[1].filters'), true);
  run('for(let i=0;i<1100;i++)socket.send(JSON.stringify(["REQ","a",{kinds:[1],authors:[String(i)]}]));');
  assert.ok(run('__realHour.queryLogDropped') > 0);
  assert.ok(run('__realHour.queryFilterCharacters') <= 4 * 1024 * 1024);
});

test('source and window evidence caps preserve forwarding and expose dropped observations', () => {
  const { run, posted } = setup();
  run('globalThis.port=new MessagePort();for(let i=0;i<256;i++)port.postMessage({t:"open",sub:"s"+i,query:{source:"home"}});');
  assert.equal(run('Object.keys(__realHour.sources).length'), 128);
  assert.equal(run('__realHour.evidenceDropped.sourceMappings'), 128);
  run('for(let i=0;i<256;i++)port.postMessage({t:"window",sub:"w"+i,anchor:"top",after:10});');
  assert.equal(run('Object.keys(__realHour.views).length'), 128);
  assert.ok(run('__realHour.evidenceDropped.views') > 0);
  assert.equal(posted.length, 512);
});

test('ID evidence cap reports lost observations and never loses previously seen IDs', () => {
  const { run } = setup();
  run('globalThis.port=new MessagePort();port.postMessage({t:"open",sub:"s",query:{source:"home"}});port.onmessage=()=>{};');
  run('port.onmessage({data:{t:"rows",sub:"s",rows:Array.from({length:40001},(_,i)=>({kind:"note",id:String(i),key:String(i)}))}});');
  assert.equal(run('__realHour.seen.home.length'), 40000);
  assert.ok(run('__realHour.evidenceDropped.ids') > 0);
  assert.ok(run('__realHour.seenDropped.home') > 0);
  const dropped = run('__realHour.evidenceDropped.ids');
  run('port.onmessage({data:{t:"patch",sub:"s",ops:[{op:"update",row:{kind:"note",id:"0",key:"0"}}]}});');
  assert.equal(run('__realHour.evidenceDropped.ids'), dropped);
});

test('lost ID, query or source evidence makes completeness unknown', () => {
  const dom = { installed: true, sources: Object.fromEntries(['home','notifications'].map(source => [source, { scopeSeen: true, count: 2, unknown: [] }])) };
  const probe = { queryLogDropped: 0, evidenceDropped: { ids: 0, sourceMappings: 0, views: 0 }, seenCounts: { home: 2 }, dom };
  const status = (changes) => evidenceStatus([{ type: 'page', probe: { ...probe, ...changes } }]);
  assert.match(status({}).completeness, /^scoped candidates/);
  assert.match(status({ queryLogDropped: 1 }).completeness, /^unknown:/);
  for (const key of ['ids', 'sourceMappings', 'views'])
    assert.match(status({ evidenceDropped: { ...probe.evidenceDropped, [key]: 1 } }).completeness, /^unknown:/);
  assert.match(status({ seenCounts: { home: 40000 } }).completeness, /^unknown:/);
  assert.match(status({ evidenceDropped: undefined }).completeness, /^unknown:/);
});


test('wire timestamps preserve first projection independently of quote or other-source IDs', () => {
  const { run } = setup();
  run('globalThis.port=new MessagePort();port.onmessage=()=>{};port.postMessage({t:"open",sub:"h",query:{source:"home"}});port.postMessage({t:"open",sub:"t",query:{source:"thread"}});');
  run('Date.now=()=>100;port.onmessage({data:{t:"rows",sub:"h",rows:[{kind:"note",id:"parent",key:"parent",quotes:[{id:"quote-only"}]}]}});');
  run('Date.now=()=>200;port.onmessage({data:{t:"patch",sub:"h",ops:[{op:"update",row:{kind:"note",id:"parent",key:"parent"}}]}});port.onmessage({data:{t:"rows",sub:"t",rows:[{kind:"note",id:"thread-only",key:"thread-only"}]}});');
  assert.equal(run('__realHour.wireFirst.home.parent'), 100);
  assert.equal(run('JSON.stringify(__realHour.seen.home)'), '["parent"]');
  assert.equal(run('__realHour.wireFirst.thread["thread-only"]'), 200);
});

test('DOM cutoff and grace cannot be satisfied by an earlier wire projection', () => {
  const summary = { installed: true, sources: { home: { scopeSeen: true, count: 1, unknown: [], scope: { account: 'a', tab: 'home' } } } };
  const start = { capturedAt: 100, wireFirst: { home: { note: 90, wireOnly: 95 } }, dom: { ...summary, first: { home: {} } } };
  const later = { capturedAt: 200, wireFirst: { home: { note: 90 } }, dom: { ...summary, first: { home: { note: 150 } } } };
  const merged = mergeObservations(start, later);
  assert.equal(observationFor(merged, 'home', 'note', 100).wireByCutoff, true);
  assert.equal(observationFor(merged, 'home', 'note', 100).domByCutoff, false);
  assert.equal(observationFor(merged, 'home', 'note', 100).domDuringGrace, true);
  assert.equal(observationFor(merged, 'home', 'wireOnly', 200).domByCutoff, false);
  assert.equal(mergeObservations(merged, later).dom.first.home.note, 150);
});

test('complete host network cannot repair missing, saturated or ambiguous DOM evidence', () => {
  const source = { scopeSeen: true, count: 2, unknown: [], scope: { account: 'a', tab: 'home' } };
  const dom = { installed: true, sources: { home: source, notifications: { ...source, scope: { account: 'a', tab: 'notifications' } } } };
  const base = { queryLogDropped: 1, evidenceDropped: { ids: 0, sourceMappings: 0, views: 0 }, seenCounts: { home: 2 } };
  const status = value => evidenceStatus([{ type: 'page', probe: { ...base, dom: value } }], { complete: true });
  assert.match(status(dom).completeness, /^scoped candidates/);
  assert.match(status(undefined).completeness, /^unknown:/);
  for (const change of [{ saturated: true }, { dropped: 1 }, { unknown: ['ambiguous-view'] }, { scopeSeen: false }])
    assert.match(status({ ...dom, sources: { ...dom.sources, home: { ...source, ...change } } }).completeness, /^unknown:/);
  const changed = mergeObservations({ dom }, { dom: { ...dom, sources: { ...dom.sources, home: { ...source, scope: { account: 'b', tab: 'home' } } } } });
  assert.match(domStatus(changed.dom, 'home'), /^unknown:/);
});


test('a captured missing DOM witness stays unknown across later valid captures, unlike an empty accumulator or inactive thread', () => {
  const source = { scopeSeen: true, count: 1, unknown: [], scope: { account: 'a', tab: 'home' } };
  const valid = { capturedAt: 200, dom: { installed: true, sources: { home: source, notifications: source, thread: { scopeSeen: false, unknown: [] } }, first: { home: { note: 150 } } } };
  const missing = { capturedAt: 100, wireFirst: { home: { note: 90 } } };
  assert.match(domStatus(mergeObservations(missing, valid).dom, 'home'), /^unknown:/);
  assert.match(domStatus(mergeObservations(mergeObservations(missing, valid), valid).dom, 'home'), /^unknown:/);
  assert.match(domStatus(mergeObservations(mergeObservations(), valid).dom, 'home'), /^scoped DOM/);
  const opened = { ...valid, capturedAt: 300, dom: { ...valid.dom, sources: { ...valid.dom.sources, thread: { ...source, scope: { account: 'a', tab: 'thread:one', focus: 'note' } } } } };
  assert.match(domStatus(mergeObservations(valid, opened).dom, 'thread'), /^scoped DOM/);
});
