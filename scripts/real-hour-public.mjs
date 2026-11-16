// Public control traffic is deliberately separate from the application sockets.
// This module can send only REQ/CLOSE and retains bounded public signed events.
import bundle from 'playwright-core/lib/utilsBundle';
import { spawnSync } from 'node:child_process';
export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export async function queryRelay(relay, filters, timeoutMs = 15000) {
  const started = Date.now(), events = new Map(), firstSeenAt = new Map(), notices = [];
  return new Promise((resolve) => {
    const socket = new bundle.ws(relay, { handshakeTimeout: timeoutMs, maxPayload: 2 * 1024 * 1024 });
    let finished = false;
    const finish = (status) => {
      if (finished) return;
      finished = true; clearTimeout(timer);
      if (socket.readyState === 1) socket.send(JSON.stringify(['CLOSE', 'control']));
      socket.terminate();
      resolve({ relay, filters, status, startedAt: started, finishedAt: Date.now(), elapsedMs: Date.now() - started,
        events: [...events.values()], firstSeenAt: Object.fromEntries(firstSeenAt), notices });
    };
    const timer = setTimeout(() => finish('timeout'), timeoutMs);
    socket.on('open', () => socket.send(JSON.stringify(['REQ', 'control', ...filters])));
    socket.on('error', (error) => { notices.push(error.message.slice(0, 200)); finish('failed'); });
    socket.on('close', () => finish('closed'));
    socket.on('message', (raw) => {
      let message;
      try { message = JSON.parse(String(raw)); } catch { return; }
      if (!Array.isArray(message)) return;
      if (message[0] === 'EVENT' && message[1] === 'control' && events.size < 20000
          && /^[0-9a-f]{64}$/.test(message[2]?.id)) {
        const event = message[2];
        events.set(event.id, event);
        if (!firstSeenAt.has(event.id)) firstSeenAt.set(event.id, Date.now());
      }
      if (message[0] === 'NOTICE' && notices.length < 20) notices.push(String(message[1]).slice(0, 200));
      if (message[0] === 'EOSE' && message[1] === 'control') finish('eose');
      if (message[0] === 'CLOSED' && message[1] === 'control') { notices.push(String(message[2])); finish('refused'); }
    });
  });
}
export async function publicAccount(relays, requested) {
  if (requested && !/^[0-9a-f]{64}$/.test(requested)) throw Error('account must be a 64-hex public key');
  const probes = await Promise.all(relays.map((relay) => queryRelay(relay, [{ kinds: [3], ...(requested ? { authors: [requested] } : {}), limit: 8 }])));
  const accepting = probes.filter((probe) => probe.events.length).map((probe) => probe.relay);
  const lists = probes.flatMap((probe) => probe.events).filter((event) => event.kind === 3)
    .sort((a, b) => b.created_at - a.created_at);
  const verification = spawnSync(process.env.LKJSTR_REAL_VERIFY ?? 'target/debug/examples/engine-public-verify', {
    input: JSON.stringify(lists), encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
  });
  if (verification.status !== 0) throw Error('Public follow-list signature verification failed');
  const accepted = new Set(JSON.parse(verification.stdout).verified);
  const valid = lists.filter((event) => accepted.has(event.id));
  const chosen = valid.find((event) => {
    const follows = event.tags.filter((tag) => tag[0] === 'p').length;
    return (requested || follows >= 100) && follows <= 2000;
  }) ?? valid[0];
  if (!chosen) throw Error('No accepting public relay returned a follow list; see relay probes');
  const follows = [...new Set(chosen.tags.filter((tag) => tag[0] === 'p' && /^[0-9a-f]{64}$/.test(tag[1])).map((tag) => tag[1]))];
  return { pubkey: chosen.pubkey, follows, followEvent: chosen, relays: accepting.slice(0, 3),
    probes: probes.map(({ events, ...probe }) => ({ ...probe, eventCount: events.length })) };
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
