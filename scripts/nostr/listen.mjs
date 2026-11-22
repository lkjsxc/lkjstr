import { randomUUID } from 'node:crypto';
import { renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isHex, transaction, unixNow } from '../nostr-enqueue.mjs';
import { APP, HANDLER, NPUB, ORIGIN, RELAYS, validEvent } from './event.mjs';
import { readRelay, searchSupport } from './relay.mjs';

const HOUR = 3600;
const LIMIT = 60;
const SEARCH_ONLY = ['wss://search.nos.today/', 'wss://relay.nostr.band/'];
const KINDS = [1, 42, 1111, 30023];
const hostname = new URL(ORIGIN).hostname;
const terms = [
  ['name', 'lkjstr'], ['npub', NPUB], ['hex', APP], ['host', hostname],
];
const boundary = /(?<![a-z0-9_-])lkjstr(?![a-z0-9_-])/i;
const npubText = new RegExp(`(?<![a-z0-9])${NPUB}(?![a-z0-9])`);
const hexText = new RegExp(`(?<![a-z0-9])${APP}(?![a-z0-9])`);
const urlText = /https?:\/\/[^\s<>"'「」【】]+/gi;

function appLink(text) {
  try {
    const url = new URL(text);
    return url.origin === ORIGIN && !url.username && !url.password;
  } catch {
    return false;
  }
}

function evidenceFor(event, trackedIds) {
  if (typeof event?.content !== 'string' || !Array.isArray(event.tags)) return [];
  const found = new Set();
  const text = event.content.replace(urlText, link => {
    if (appLink(link.replace(/[),.!?、。）]+$/u, ''))) found.add('link');
    return ' ';
  }).toLowerCase();
  if (boundary.test(text)) found.add('name');
  if (npubText.test(text)) found.add('npub');
  if (hexText.test(text)) found.add('hex');
  for (const tag of event.tags) {
    if (!Array.isArray(tag)) continue;
    if (tag[0] === 'p' && tag[1] === APP) found.add('app-tag');
    if (tag[0] === 'a' && tag[1] === HANDLER) found.add('handler');
    if (tag[0] === 'e' && trackedIds.includes(tag[1])) found.add('reply');
    if (tag[0] === 'r' && typeof tag[1] === 'string' && appLink(tag[1])) found.add('link');
  }
  return [...found].sort();
}

function lanes(search, ids, searchOnly) {
  const filters = searchOnly ? [] : [
    ['app-tag', { '#p': [APP] }], ['handler', { '#a': [HANDLER] }],
    ['link-tag', { '#r': [ORIGIN, ORIGIN + '/'] }],
  ];
  if (!searchOnly && ids.length) filters.push(['reply', { '#e': ids }]);
  if (search === 'advertised') {
    for (const [lane, term] of terms) filters.push([`search-${lane}`, { search: term }]);
  }
  return filters;
}

function initListener(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS feedback_cursor (
      relay TEXT NOT NULL, lane TEXT NOT NULL, frontier INTEGER NOT NULL, width INTEGER NOT NULL,
      PRIMARY KEY (relay, lane)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, first_seen INTEGER NOT NULL,
      item TEXT NOT NULL, triaged_at INTEGER
    ) STRICT;
    CREATE TABLE IF NOT EXISTS feedback_lease (
      singleton INTEGER PRIMARY KEY CHECK (singleton = 1), token TEXT NOT NULL, until INTEGER NOT NULL
    ) STRICT;
  `);
}

function acquire(db, now) {
  const token = randomUUID();
  const result = db.prepare(`INSERT INTO feedback_lease VALUES (1, ?, ?)
    ON CONFLICT (singleton) DO UPDATE SET token=excluded.token, until=excluded.until
    WHERE feedback_lease.until <= ?`).run(token, now + 120, now);
  if (!result.changes) throw new Error('Feedback listener is already active');
  return token;
}

function remember(items, event, matched, relay) {
  const item = items.get(event.id) ?? { id: event.id, author: event.pubkey, kind: event.kind,
    createdAt: event.created_at, excerpt: Array.from(event.content
      .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]+/gu, ' ').trim()).slice(0, 260).join(''), matches: [], relays: [] };
  item.relays = [...new Set([...item.relays, relay])].sort();
  item.matches = [...new Set([...item.matches, ...matched])].sort();
  items.set(event.id, item);
}

async function readLanes(db, relay, trackedIds, now, items, { info, read, searchOnly }) {
  const search = await info(relay);
  const results = [];
  for (const [lane, filter] of lanes(search, trackedIds, searchOnly.includes(relay))) {
    const prior = db.prepare('SELECT frontier, width FROM feedback_cursor WHERE relay = ? AND lane = ?')
      .get(relay, lane);
    const frontier = Math.max(prior?.frontier ?? now - 6 * HOUR, now - 48 * HOUR);
    const width = prior?.width ?? 6 * HOUR;
    const since = Math.max(frontier - 600, now - 48 * HOUR);
    const until = Math.min(now - 30, frontier + width);
    if (until < since) continue;
    let invalid = 0;
    const result = await read(relay, { ...filter, kinds: KINDS, since, until, limit: LIMIT }, event => {
      if (!event || !KINDS.includes(event.kind) || event.pubkey === APP ||
          event.created_at < since || event.created_at > until) return;
      const matched = evidenceFor(event, trackedIds);
      if (!matched.length) return;
      if (validEvent(event)) remember(items, event, matched, relay);
      else invalid++;
    });
    const status = invalid && result.status === 'complete' ? 'invalid-event' : result.status;
    results.push({ ...result, status, lane, since, until, invalid, frontier,
      nextFrontier: status === 'complete' ? until : frontier,
      nextWidth: status === 'saturated' ? Math.max(900, Math.floor(width / 2)) :
        status === 'complete' ? Math.min(6 * HOUR, width * 2) : width });
  }
  return { relay, search, results };
}

function persist(db, token, now, items, reports) {
  return transaction(db, () => {
    if (!db.prepare('SELECT 1 FROM feedback_lease WHERE token = ?').get(token)) {
      throw new Error('Feedback listener lost its lease');
    }
    const get = db.prepare('SELECT item FROM feedback WHERE id = ?');
    const put = db.prepare(`INSERT INTO feedback (id, created_at, first_seen, item) VALUES (?, ?, ?, ?) ON CONFLICT (id)
      DO UPDATE SET item=excluded.item`);
    for (const item of items.values()) {
      const former = get.get(item.id);
      if (former) {
        const old = JSON.parse(former.item);
        item.relays = [...new Set([...item.relays, ...old.relays])].sort();
        item.matches = [...new Set([...item.matches, ...old.matches])].sort();
      }
      put.run(item.id, item.createdAt, now, JSON.stringify(item));
    }
    const cursor = db.prepare(`INSERT INTO feedback_cursor VALUES (?, ?, ?, ?)
      ON CONFLICT (relay, lane) DO UPDATE SET frontier=excluded.frontier, width=excluded.width`);
    for (const report of reports) {
      for (const row of report.results) cursor.run(report.relay, row.lane, row.nextFrontier, row.nextWidth);
    }
    db.prepare('DELETE FROM feedback WHERE first_seen < ?').run(now - 14 * 24 * HOUR);
    db.exec(`DELETE FROM feedback WHERE id IN (SELECT id FROM feedback
      ORDER BY first_seen DESC, created_at DESC, id LIMIT -1 OFFSET 500)`);
    const total = db.prepare('SELECT count(*) AS n FROM feedback WHERE triaged_at IS NULL').get().n;
    const backlog = db.prepare(`SELECT item, first_seen FROM feedback WHERE triaged_at IS NULL
      ORDER BY first_seen DESC, created_at DESC, id LIMIT 40`).all()
      .map(row => ({ ...JSON.parse(row.item), firstSeen: row.first_seen }));
    return { version: 1, capturedAt: now, untrustedExcerpts: true, total, backlog, reports };
  });
}

export async function listen(db, directory, {
  relays = [...RELAYS, ...SEARCH_ONLY], searchOnly = SEARCH_ONLY,
  info = searchSupport, read = readRelay, clock = unixNow,
} = {}) {
  initListener(db);
  const now = clock();
  const token = acquire(db, now);
  const pendingPath = join(directory, `.feedback-${token}.tmp`);
  try {
    const ids = db.prepare(`SELECT event_id FROM announcements WHERE delivered_at >= ?
      ORDER BY delivered_at DESC LIMIT 8`).all(now - 14 * 24 * HOUR).map(row => row.event_id);
    const items = new Map();
    const reports = await Promise.all(relays.map(relay => readLanes(db, relay, ids, now, items, { info, read, searchOnly })));
    const digest = persist(db, token, now, items, reports);
    writeFileSync(pendingPath, JSON.stringify(digest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    const path = join(directory, 'feedback.json');
    renameSync(pendingPath, path);
    return { path, uniqueThisRun: items.size, retained: digest.total,
      incomplete: reports.reduce((sum, row) => sum + row.results.filter(item => item.status !== 'complete').length, 0) };
  } finally {
    try {
      rmSync(pendingPath, { force: true });
    } finally {
      db.prepare('DELETE FROM feedback_lease WHERE token = ?').run(token);
    }
  }
}

export function acknowledgeFeedback(db, ids) {
  if (!ids.every(id => isHex(id, 64))) throw new Error('Expected exact feedback event IDs');
  initListener(db);
  return transaction(db, () => {
    const mark = db.prepare('UPDATE feedback SET triaged_at = ? WHERE id = ? AND triaged_at IS NULL');
    const now = unixNow();
    return { acknowledged: ids.reduce((count, id) => count + mark.run(now, id).changes, 0) };
  });
}
