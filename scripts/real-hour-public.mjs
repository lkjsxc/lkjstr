// Public control traffic is deliberately separate from the application sockets.
// This module can send only REQ/CLOSE and retains bounded public signed events.
import bundle from 'playwright-core/lib/utilsBundle';
import { spawnSync } from 'node:child_process';
export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export async function queryRelay(relay, filters, timeoutMs = 15000, { budget } = {}) {
  const started = Date.now(), events = new Map(), firstSeenAt = new Map(), notices = [];
  timeoutMs = Math.min(timeoutMs, budget?.remaining() ?? timeoutMs);
  if (timeoutMs <= 0) return { relay, filters, status: 'budget', startedAt: started, finishedAt: started, elapsedMs: 0, events: [], firstSeenAt: {}, notices: [], budget: budget?.snapshot() };
  return new Promise((resolve) => {
    let socket;
    try { socket = new bundle.ws(relay, { handshakeTimeout: timeoutMs, maxPayload: budget?.maxFrameBytes ?? 2 * 1024 * 1024 }); }
    catch (error) {
      resolve({ relay, filters, status: 'failed', startedAt: started, finishedAt: Date.now(), elapsedMs: Date.now() - started,
        events: [], firstSeenAt: {}, notices: [String(error).slice(0, 200)], ...(budget ? { budget: budget.snapshot() } : {}) });
      return;
    }
    let finished = false, unlisten;
    const finish = (status) => {
      if (finished) return;
      finished = true; clearTimeout(timer); unlisten?.();
      try { if (socket.readyState === 1) socket.send(JSON.stringify(['CLOSE', 'control'])); }
      catch (error) { notices.push(String(error).slice(0, 200)); }
      socket.terminate();
      resolve({ relay, filters, status, startedAt: started, finishedAt: Date.now(), elapsedMs: Date.now() - started,
        events: [...events.values()], firstSeenAt: Object.fromEntries(firstSeenAt), notices,
        ...(budget ? { budget: budget.snapshot() } : {}) });
    };
    const timer = setTimeout(() => { if (budget && !budget.remaining()) finish('budget'); else finish('timeout'); }, timeoutMs);
    unlisten = budget?.listen(() => finish('budget'));
    socket.on('open', () => {
      if (finished) return;
      try { socket.send(JSON.stringify(['REQ', 'control', ...filters])); }
      catch (error) { notices.push(String(error).slice(0, 200)); finish('failed'); }
    });
    socket.on('error', (error) => { notices.push(error.message.slice(0, 200));
      if (budget && error.code === 'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH') budget.stop('single-frame-byte-limit');
      finish('failed'); });
    socket.on('close', () => finish('closed'));
    socket.on('message', (raw) => {
      if (finished || (budget && !budget.frame(raw))) return;
      let message;
      try { message = JSON.parse(String(raw)); } catch { return; }
      if (!Array.isArray(message)) return;
      if (message[0] === 'EVENT' && message[1] === 'control' && events.size < 20000
          && /^[0-9a-f]{64}$/.test(message[2]?.id)) {
        const event = message[2];
        if (budget && !budget.event(event.id)) return;
        events.set(event.id, event);
        if (!firstSeenAt.has(event.id)) firstSeenAt.set(event.id, Date.now());
      }
      if (message[0] === 'NOTICE' && notices.length < 20) notices.push(String(message[1]).slice(0, 200));
      if (message[0] === 'EOSE' && message[1] === 'control') finish('eose');
      if (message[0] === 'CLOSED' && message[1] === 'control') { notices.push(String(message[2])); finish('refused'); }
    });
  });
}
export async function publicAccount(relays, requested, { budget, includeCandidates = false } = {}) {
  if (requested && !/^[0-9a-f]{64}$/.test(requested)) throw Error('account must be a 64-hex public key');
  const probes = await Promise.all(relays.map((relay) => queryRelay(relay, [{ kinds: [3], ...(requested ? { authors: [requested] } : {}), limit: 8 }], 15000, { budget })));
  const accepting = probes.filter((probe) => probe.events.length).map((probe) => probe.relay);
  const lists = probes.flatMap((probe) => probe.events).filter((event) => event.kind === 3)
    .sort((a, b) => b.created_at - a.created_at);
  const verification = spawnSync(process.env.LKJSTR_REAL_VERIFY ?? 'target/debug/examples/engine-public-verify', {
    input: JSON.stringify(lists), encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
    ...(budget ? { timeout: Math.max(1, budget.remaining()) } : {}),
  });
  if (verification.status !== 0) throw Error('Public follow-list signature verification failed');
  const accepted = new Set(JSON.parse(verification.stdout).verified);
  const valid = lists.filter((event) => accepted.has(event.id) && (!requested || event.pubkey === requested));
  const chosen = valid.find((event) => {
    const follows = event.tags.filter((tag) => tag[0] === 'p').length;
    return (requested || follows >= 100) && follows <= 2000;
  }) ?? valid[0];
  if (!chosen) throw Error('No accepting public relay returned a follow list; see relay probes');
  const account = event => ({ pubkey: event.pubkey,
    follows: [...new Set(event.tags.filter(tag => tag[0] === 'p' && /^[0-9a-f]{64}$/.test(tag[1])).map(tag => tag[1]))],
    followEvent: event, relays: accepting.slice(0, 3),
    probes: probes.map(({ events, ...probe }) => ({ ...probe, eventCount: events.length })) });
  const candidates = [chosen];
  if (includeCandidates && !requested) for (const event of valid) {
    const count = event.tags.filter(tag => tag[0] === 'p').length;
    if (candidates.length < 3 && count >= 100 && count <= 2000 && !candidates.some(item => item.pubkey === event.pubkey)) candidates.push(event);
  }
  return { ...account(chosen), ...(includeCandidates ? { candidates: candidates.map(account) } : {}) };
}
export async function controlPages(relays, filter, cap = 3000) {
  const events = new Map(), firstSeenAt = new Map(), pages = [];
  for (const relay of relays.slice(0, 8)) {
    let until = filter.until;
    for (let page = 0; page < 12 && events.size < cap; page++) {
      const result = await queryRelay(relay, [{ ...filter, ...(until === undefined ? {} : { until }), limit: 500 }]);
      pages.push({ relay, status: result.status, startedAt: result.startedAt, finishedAt: result.finishedAt,
        elapsedMs: result.elapsedMs, count: result.events.length, notices: result.notices, until });
      for (const event of result.events) if (events.size < cap) {
        events.set(event.id, event);
        const at = result.firstSeenAt[event.id];
        firstSeenAt.set(event.id, Math.min(firstSeenAt.get(event.id) ?? at, at));
      }
      if (result.status !== 'eose' || result.events.length < 500) break;
      const oldest = Math.min(...result.events.map((event) => event.created_at));
      if (oldest === until || oldest <= (filter.since ?? 0)) break;
      until = oldest; // Include timestamp ties; duplicate IDs do not consume the cap.
      await delay(300);
    }
  }
  return { filter, pages, events: [...events.values()], firstSeenAt: Object.fromEntries(firstSeenAt) };
}
