// Read-only sidecar for the existing owned measurement browser; never starts or closes it.
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { ownedDirectory, validateOwnedRun } from './real-hour-owned.mjs';
import { loadavg } from 'node:os';
import bundle from 'playwright-core/lib/utilsBundle';
import { routeControls, nativeEligibility } from './real-hour-audit.mjs';
import { sourceFilter, controlCoverage } from './real-hour-coverage.mjs';
const root = new URL('../', import.meta.url).pathname;
const directory = await ownedDirectory(root, process.argv[2]);
const output = `${directory}/gap-audit-${new Date().toISOString().replaceAll(':','-').replaceAll('.','-')}`;
await mkdir(output);
process.env.LKJSTR_REAL_VERIFY = `${directory}/bin/engine-public-verify`;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = { started: new Date().toISOString(), initialLoadAverage: loadavg(), scope: 'Owned public-npub browser; observation begins only after the completed hour. At most three actual responsive source relays; direct REQ/CLOSE only.', errors: [], snapshots: [], traffic: { eose: [], notes: [], eventBytes: 0, dropped: 0 } };
let cached, modified = 0, rpc;
const save = () => writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
async function mainReport() {
  const time = (await stat(`${directory}/report.json`)).mtimeMs;
  if (time !== modified) {
    try { cached = JSON.parse(await readFile(`${directory}/report.json`, 'utf8')); modified = time; } catch { /* writer still owns the partial file */ }
  }
  return cached;
}
async function until(test, seconds = 5400) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    const value = await mainReport();
    if (value?.failure || value?.interrupted) throw Error('Main measurement failed or interrupted');
    if (value && test(value)) return value;
    if (value?.complete) throw Error('Main measurement ended before the requested phase');
    await delay(500);
  }
  throw Error('Sidecar phase deadline');
}
async function connect(account) {
  const [port, path] = (await readFile(`${directory}/profile/DevToolsActivePort`, 'utf8')).trim().split('\n');
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535 || !/^\/devtools\/browser\/[0-9a-f-]+$/.test(path)) throw Error('Invalid owned-browser endpoint');
  const socket = new bundle.ws(`ws://127.0.0.1:${port}${path}`), pending = new Map(), sessions = new Map(), sockets = new Map();
  const authors = new Set([account.pubkey, ...account.follows]);
  let serial = 0;
  const send = (method, params = {}, sessionId, ms = 3000) => new Promise((resolve, reject) => {
    const id = ++serial, timer = setTimeout(() => { pending.delete(id); reject(Error(`CDP timeout ${method}`)); }, ms);
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  socket.on('message', raw => {
    const msg = JSON.parse(String(raw));
    if (msg.id) {
      const item = pending.get(msg.id); if (!item) return;
      clearTimeout(item.timer); pending.delete(msg.id);
      if (msg.error) item.reject(Error(msg.error.message)); else item.resolve(msg.result);
      return;
    }
    const data = msg.params ?? {}, key = `${msg.sessionId}:${data.requestId}`;
    if (msg.method === 'Network.webSocketCreated') { if (sockets.size < 128) sockets.set(key, data.url); else report.traffic.dropped++; }
    if (msg.method === 'Network.webSocketClosed') sockets.delete(key);
    if (msg.method !== 'Network.webSocketFrameReceived') return;
    const payload = data.response?.payloadData;
    if (typeof payload !== 'string' || payload.length > 2 * 1024 * 1024) { report.traffic.dropped++; return; }
    try {
      const frame = JSON.parse(payload), relay = sockets.get(key), at = Date.now();
      if (frame[0] === 'EOSE') {
        if (report.traffic.eose.length < 2000) report.traffic.eose.push({ at, relay, sub: frame[1] }); else report.traffic.dropped++;
      }
      const event = frame[2];
      if (frame[0] === 'EVENT' && event?.kind === 1 && event.created_at * 1000 >= report.gapStart - 1000
          && (authors.has(event.pubkey) || event.tags?.some(tag => tag[0] === 'p' && tag[1] === account.pubkey))) {
        const bytes = Buffer.byteLength(JSON.stringify(event));
        if (bytes <= 65536 && report.traffic.notes.length < 3000 && report.traffic.eventBytes + bytes <= 4 * 1024 * 1024) {
          report.traffic.eventBytes += bytes;
          report.traffic.notes.push({ at, relay, sub: frame[1], id: event.id, pubkey: event.pubkey, created_at: event.created_at, event });
        } else report.traffic.dropped++;
      }
    } catch { /* The engine owns protocol validity; this records no malformed note as evidence. */ }
  });
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
  async function refresh() {
    const targets = (await send('Target.getTargets')).targetInfos;
    for (const target of targets) {
      if (!['page', 'worker', 'shared_worker'].includes(target.type) || !target.url.startsWith(report.origin)) continue;
      if ([...sessions.values()].some(value => value.targetId === target.targetId)) continue;
      const { sessionId } = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
      sessions.set(sessionId, target);
      if (target.type !== 'page') await send('Network.enable', {}, sessionId);
    }
    for (const [session, target] of sessions) if (!targets.some(value => value.targetId === target.targetId)) sessions.delete(session);
    return sessions;
  }
  async function evaluate(session, expression, ms = 2000) {
    const out = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, session, ms);
    if (out.exceptionDetails) throw Error(out.exceptionDetails.text);
    return out.result?.value;
  }
  return { sessions, refresh, evaluate, async close() {
    for (const sessionId of sessions.keys()) await send('Target.detachFromTarget', { sessionId }).catch(() => {});
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(Error('Sidecar detached')); }
    pending.clear(); socket.close();
  } };
}
const seen = { home: new Set(), notifications: new Set(), thread: new Set() }, pageCoverage = new Map();
const snapshotExpression = `({at:Date.now(),visibility:document.visibilityState,seen:globalThis.__realHour?.seen??{},views:globalThis.__realHour?.views??{},queryDropped:globalThis.__realHour?.queryLogDropped??0,evidenceDropped:globalThis.__realHour?.evidenceDropped})`;
async function snapshot() {
  await rpc.refresh();
  for (const [session, target] of rpc.sessions) if (target.type === 'page') {
    try {
      const data = await rpc.evaluate(session, snapshotExpression);
      if (!data) continue;
      if (!data.evidenceDropped || Object.values(data.evidenceDropped).some(value=>value>0)) report.observationEvidenceUnknown = true;
      for (const source of Object.keys(seen)) for (const id of data.seen[source] ?? []) {
        if (seen[source].size < 40000) seen[source].add(id); else report.seenEvidenceDropped = true;
      }
      const coverage = pageCoverage.get(target.targetId) ?? { first: data.at, observations: 0 };
      coverage.last = data.at; coverage.observations++; pageCoverage.set(target.targetId, coverage);
      report.lastViews = data.views;
      if (report.snapshots.length < 160) report.snapshots.push({ at: data.at, target: target.targetId, visibility: data.visibility, counts: Object.fromEntries(Object.entries(data.seen).map(([source, ids]) => [source, ids.length])) });
    } catch (error) { if (report.errors.length < 20) report.errors.push({ stage: 'page-observation', error: String(error) }); }
  }
}
const contextExpression = `(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('lkjstr-wasm');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});try{return await new Promise((resolve,reject)=>{const r=db.transaction('events').objectStore('events').getAll(undefined,20000);r.onerror=()=>reject(r.error);r.onsuccess=()=>resolve(r.result.flatMap(row=>{try{const e=JSON.parse(row.raw);return Array.isArray(e)&&e[0]===1?[{id:e[1],pubkey:e[2],created_at:e[3],kind:e[4],tags:e[5],content:e[6],sig:e[7]}]:e?.id?[e]:[]}catch{return []}}))})}finally{db.close()}})()`;
try {
  const first = await until(value => value.liveElapsedSeconds >= 3600 && value.scenarios?.outage600?.started);
  report.association = await validateOwnedRun(root, directory, first, new URL(import.meta.url));
  report.hourElapsedSeconds = first.liveElapsedSeconds;
  report.gapStart = Date.parse(first.scenarios.outage600.started);
  report.gapStarted = first.scenarios.outage600.started;
  report.origin = new URL(first.firstTargets.find(target => target.type.includes('worker')).url).origin;
  const account = JSON.parse(await readFile(`${directory}/account-public.json`, 'utf8'));
  if (account.pubkey !== first.account?.pubkey) throw Error('Public account artifact mismatch');
  rpc = await connect(account);
  for (const source of Object.keys(seen)) for (const id of first.savedSeen?.[source] ?? []) seen[source].add(id);
  await snapshot();
  report.observationBegan = new Date().toISOString();
  await save();
  await until(value => value.scenarios?.outage600?.elapsedSeconds >= 570, 660);
  const captureDeadline = Date.now() + 180000;
  while (Date.now() < captureDeadline) {
    await snapshot();
    const main = await mainReport();
    if (main.scenarios?.outage600?.recovery) {
      report.socketRecovery = { observedByMain: main.scenarios.outage600.recovery.connectedMs, qualification: 'Socket/REQ timing only; not a delivered-note recovery metric' };
      report.resumeLowerBound = report.gapStart + main.scenarios.outage600.elapsedSeconds * 1000;
    }
    if (main.scenarios?.sharedTabs?.afterClose) break;
    await delay(500);
  }
  await snapshot();
  report.captureAt = Date.now(); report.captureLoadAverage = loadavg();
  report.pageCoverage = Object.fromEntries(pageCoverage);
  report.observedIds = Object.fromEntries(Object.entries(seen).map(([source, ids]) => [source, [...ids]]));
  let context, queries = [];
  for (const [session, target] of rpc.sessions) {
    if (target.type === 'page' && !context) context = await rpc.evaluate(session, contextExpression, 10000).catch(() => undefined);
    if (target.type.includes('worker')) {
      const data = await rpc.evaluate(session, `({queries:(globalThis.__realHour?.queries??[]).filter(q=>q.filters.some(f=>f.kinds?.includes(1)&&f.kinds?.length<=6)),dropped:globalThis.__realHour?.queryLogDropped??0,forbidden:globalThis.__realHour?.forbidden??0})`, 10000);
      queries.push(...data.queries); report.queryEvidenceDropped = (report.queryEvidenceDropped ?? 0) + data.dropped;
      if (data.forbidden) throw Error('Main read-only guard recorded a forbidden frame');
    }
  }
  if (!context) throw Error('Owned page public context unavailable');
  await writeFile(`${output}/public-context.json`, JSON.stringify(context));
  await writeFile(`${output}/queries.json`, JSON.stringify(queries));
  await rpc.close(); rpc = undefined;
  const focus = first.scenarios.thread?.focus;
  const relevant = source => queries.filter(q => q.at <= report.captureAt && (q.closedAt ?? report.captureAt) >= report.gapStart
    && q.filters.some(f => sourceFilter(f, source, account, focus) && (f.until === undefined || f.until >= Math.floor(report.gapStart / 1000))));
  const candidates = new Map();
  for (const source of ['home','notifications','thread']) for (const q of relevant(source)) {
    const route = candidates.get(q.relay) ?? { relay: q.relay, sources: new Set(), eoseAfterGap: 0 };
    route.sources.add(source);
    if (q.eoseAt >= report.resumeLowerBound && q.eoseAt <= report.captureAt) route.eoseAfterGap++;
    candidates.set(q.relay, route);
  }
  const selected = [...candidates.values()].filter(route => route.eoseAfterGap > 0).sort((a,b) => b.sources.size-a.sources.size || b.eoseAfterGap-a.eoseAfterGap).slice(0,3);
  report.relaySelection = [...candidates.values()].map(route => ({...route,sources:[...route.sources],selected:selected.includes(route),reason:route.eoseAfterGap ? 'Actual matching source answered EOSE after the gap' : 'No post-gap EOSE; excluded from responsive controls'}));
  const latestFollow = context.filter(event => event.kind === 3 && event.pubkey === account.pubkey).sort((a,b)=>b.created_at-a.created_at||a.id.localeCompare(b.id))[0] ?? account.followEvent;
  const authors = [...new Set([account.pubkey,...latestFollow.tags.filter(tag=>tag[0]==='p').map(tag=>tag[1])])];
  report.followsChanged = latestFollow.id !== account.followEvent.id;
  const since = Math.floor(report.gapStart/1000), untilTime = Math.floor(report.captureAt/1000), controls = {};
  for (const source of ['home','notifications']) {
    const routes = selected.filter(route=>route.sources.has(source)).map(route=>route.relay);
    controls[source] = await routeControls(routes, source==='home' ? {kinds:[1],authors,since,until:untilTime,limit:500} : {kinds:[1],'#p':[account.pubkey],since,until:untilTime,limit:500}, 3000);
  }
  const checkedEvents = [...controls.home.events, ...controls.notifications.events, ...report.traffic.notes.map(note => note.event)];
  const native = nativeEligibility(checkedEvents, context, Object.fromEntries(['home','notifications'].map(source=>[source,{query:report.lastViews?.[source]?.query??{source,account:account.pubkey},since,until:untilTime}])));
  report.window = {since,until:untilTime}; report.native = {rejected:native.rejected,storeEvents:native.storeEvents,evictions:native.storeEvictions};
  report.controls = {};
  for (const source of ['home','notifications']) {
    const sample=controls[source], eligible=sample.events.filter(event=>native.eligibility[source].eligible.includes(event.id));
    const coverage=controlCoverage({events:eligible,sample,queries,source,account,startedAt:report.gapStart,endedAt:report.captureAt});
    report.controls[source]={pages:sample.pages,eligible:eligible.map(event=>event.id),excluded:native.eligibility[source].excluded,coverage,
      missingCandidates:eligible.filter(event=>!seen[source].has(event.id)).map(event=>({id:event.id,attribution:coverage.events.find(item=>item.id===event.id)})),
      completeness:!eligible.length?'unknown: responsive same-source controls returned no eligible data':report.queryEvidenceDropped||report.seenEvidenceDropped||report.observationEvidenceUnknown||report.followsChanged?'unknown: capped evidence or changed follow set':'scoped control comparison only; page-close capture boundaries and relay completeness remain limitations'};
  }
  report.thread={focus,sourceQueries:relevant('thread'),scope:relevant('thread').length?'Matching thread lifetime recorded; no extra thread control outside three-relay budget':'No actual thread source overlapped the outage; earlier thread check remains separate, gap completeness unknown'};
  const eligibleIds=new Set([...native.eligibility.home.eligible,...native.eligibility.notifications.eligible]);
  const canonical = event => JSON.stringify([event.id,event.pubkey,event.created_at,event.kind,event.tags,event.content,event.sig]);
  const variants = new Map();
  for (const event of checkedEvents) { const values = variants.get(event.id) ?? new Set(); values.add(canonical(event)); variants.set(event.id,values); }
  const verified = new Set(native.verified);
  report.validatedTraffic = report.traffic.notes.filter(note => eligibleIds.has(note.id) && verified.has(note.id) && variants.get(note.id)?.size === 1).map(({event,...note}) => note);
  report.trafficVerification = 'Exact retained event payloads are natively verified; an ID with multiple differing payloads is excluded from validated traffic. Metadata-only socket/REQ evidence is not a delivery proof.';
  await writeFile(`${output}/received-events.json`,JSON.stringify(report.traffic.notes));
  report.traffic.notes = report.traffic.notes.map(({event,...note}) => note);
  await writeFile(`${output}/direct-controls.json`,JSON.stringify(controls));
  report.complete=true;
} catch(error) { report.failure=String(error?.stack??error).slice(0,3000);process.exitCode=1; }
finally { await rpc?.close(); report.finished=new Date().toISOString();report.finalLoadAverage=loadavg();await save();console.log(JSON.stringify({output,complete:report.complete??false,failure:report.failure})); }
