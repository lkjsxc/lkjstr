// The public harness must stop forbidden frames before they reach any socket.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createContext, runInContext } from 'node:vm';
import { observeRelease } from './real-hour-observe.mjs';
import { sourceFilter, controlCoverage, evidenceStatus } from './real-hour-coverage.mjs';
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
test('observation includes rows, patch inserts and updates; removing a row retains evidence it was shown', () => {
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

test('control attribution excludes count hydration and notes after a route closed', () => {
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
  const probe = { queryLogDropped: 0, evidenceDropped: { ids: 0, sourceMappings: 0, views: 0 }, seenCounts: { home: 2 } };
  const status = (changes) => evidenceStatus([{ type: 'page', probe: { ...probe, ...changes } }]);
  assert.match(status({}).completeness, /^scoped candidates/);
  assert.match(status({ queryLogDropped: 1 }).completeness, /^unknown:/);
  for (const key of ['ids', 'sourceMappings', 'views'])
    assert.match(status({ evidenceDropped: { ...probe.evidenceDropped, [key]: 1 } }).completeness, /^unknown:/);
  assert.match(status({ seenCounts: { home: 40000 } }).completeness, /^unknown:/);
  assert.match(status({ evidenceDropped: undefined }).completeness, /^unknown:/);
});
