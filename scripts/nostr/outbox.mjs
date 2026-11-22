import { transaction, unixNow } from '../nostr-enqueue.mjs';
import { APP, ORIGIN, RELAYS, eventFields, sameEvent, validEvent } from './event.mjs';
import { requiredRelease } from './review.mjs';
import { readRelay, sendRelay } from './relay.mjs';

const DAY = 86400;
const ATTEMPT_LEASE = 90;

export function initOutbox(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS announcements (
      revision TEXT PRIMARY KEY REFERENCES releases,
      draft_sha256 TEXT, approval TEXT, content TEXT, approved_at INTEGER,
      event_id TEXT UNIQUE, event TEXT, delivered_at INTEGER
    ) STRICT;
    CREATE TABLE IF NOT EXISTS announcement_members (
      revision TEXT PRIMARY KEY REFERENCES releases,
      announcement TEXT NOT NULL REFERENCES announcements
    ) STRICT;
    CREATE TABLE IF NOT EXISTS attempts (
      id INTEGER PRIMARY KEY,
      announcement TEXT NOT NULL REFERENCES announcements,
      started_at INTEGER NOT NULL, sent_at INTEGER, status TEXT NOT NULL,
      preflight TEXT, acknowledgments TEXT, readbacks TEXT, evidence TEXT
    ) STRICT;
    CREATE INDEX IF NOT EXISTS attempts_sent ON attempts (sent_at);
    CREATE INDEX IF NOT EXISTS attempts_release ON attempts (announcement, id);
  `);
}

function claim(db, revision, sign, now) {
  return transaction(db, () => {
    const row = db.prepare('SELECT * FROM announcements WHERE revision = ?').get(revision);
    if (!row?.approval && !row?.event) throw new Error('Release has no approved announcement');
    if (row?.delivered_at) return { done: true, event: JSON.parse(row.event) };
    if (db.prepare(`SELECT 1 FROM attempts WHERE announcement = ? AND started_at > ?
        AND status IN ('preflight', 'sending')`).get(revision, now - ATTEMPT_LEASE)) {
      throw new Error('Announcement already has an active attempt');
    }
    db.prepare(`UPDATE attempts SET status = 'interrupted' WHERE announcement = ?
      AND status IN ('preflight', 'sending')`).run(revision);
    const event = row.event ? JSON.parse(row.event) : sign(row.content, revision, now);
    if (!validEvent(event) || (row.event && row.event_id !== event.id)) {
      throw new Error('Announcement event failed signature or identity verification');
    }
    if (!row.event) {
      db.prepare('UPDATE announcements SET event_id = ?, event = ? WHERE revision = ?')
        .run(event.id, JSON.stringify(event), revision);
    }
    const id = db.prepare(`INSERT INTO attempts (announcement, started_at, status) VALUES (?, ?, 'preflight')`)
      .run(revision, now).lastInsertRowid;
    return { id, event };
  });
}

function reserve(db, revision, id, now) {
  return transaction(db, () => {
    if (!db.prepare(`SELECT 1 FROM attempts WHERE id = ? AND status = 'preflight' AND started_at > ?`)
      .get(id, now - ATTEMPT_LEASE)) {
      throw new Error('Announcement attempt lost its lease before send');
    }
    const others = db.prepare(`SELECT count(DISTINCT announcement) AS count FROM attempts
      WHERE sent_at >= ? AND announcement != ?`).get(now - DAY, revision).count;
    if (others >= 2) {
      db.prepare("UPDATE attempts SET status = 'daily-cap' WHERE id = ?").run(id);
      return false;
    }
    db.prepare("UPDATE attempts SET sent_at = ?, status = 'sending' WHERE id = ?").run(now, id);
    return true;
  });
}

function confirmed(outcomes) {
  return outcomes.some(row => row.status === 'exact-event');
}

function readback(relays, event, read) {
  return Promise.all(relays.map(async relay => {
    let exact;
    const outcome = await read(relay, { ids: [event.id], limit: 2 }, received => {
      if (!sameEvent(event, received)) return false;
      exact = eventFields(received);
      return true;
    });
    return exact ? { ...outcome, event: exact } : outcome;
  }));
}

function finish(db, revision, id, outcomes, now) {
  const status = confirmed(outcomes) ? 'delivered' : 'unconfirmed';
  transaction(db, () => {
    db.prepare('UPDATE attempts SET readbacks = ?, status = ? WHERE id = ?')
      .run(JSON.stringify(outcomes), status, id);
    if (status === 'delivered') db.prepare(`UPDATE announcements SET delivered_at = coalesce(delivered_at, ?)
      WHERE revision = ?`).run(now, revision);
  });
  return status;
}

export async function publish(db, revision, sign, {
  relays = RELAYS, read = readRelay, send = sendRelay, clock = unixNow,
} = {}) {
  requiredRelease(db, revision);
  const { done, id, event } = claim(db, revision, sign, clock());
  if (done) return { id: event.id, status: 'delivered' };
  const before = await readback(relays, event, read);
  db.prepare('UPDATE attempts SET preflight = ? WHERE id = ?').run(JSON.stringify(before), id);
  if (confirmed(before)) return { id: event.id, status: finish(db, revision, id, before, clock()) };
  if (!reserve(db, revision, id, clock())) return { id: event.id, status: 'daily-cap' };
  const acknowledgments = await Promise.all(relays.map(relay => send(relay, event)));
  db.prepare('UPDATE attempts SET acknowledgments = ? WHERE id = ?').run(JSON.stringify(acknowledgments), id);
  const after = await readback(relays, event, read);
  return { id: event.id, status: finish(db, revision, id, after, clock()) };
}

export async function recordExisting(db, revision, event, {
  relays = RELAYS, read = readRelay, clock = unixNow, historical,
} = {}) {
  const release = requiredRelease(db, revision);
  if (event?.kind !== 1 || event.pubkey !== APP || !validEvent(event) ||
      event.created_at < release.verifiedAt - 60 || event.created_at > clock() + 60 ||
      !event.content.split(/\s+/).some(word => word === ORIGIN || word === ORIGIN + '/') ||
      Buffer.byteLength(event.content) > 4096) {
    throw new Error('Expected the original signed app announcement for this verified release');
  }
  const outcomes = historical?.readbacks ?? await readback(relays, event, read);
  if (!confirmed(outcomes)) throw new Error('Existing announcement has no exact relay readback');
  return transaction(db, () => {
    const existing = db.prepare('SELECT event_id FROM announcements WHERE revision = ?').get(revision);
    if (existing) {
      if (existing.event_id !== event.id) throw new Error('Release already has a different staged announcement');
      const original = JSON.parse(db.prepare('SELECT event FROM announcements WHERE revision = ?').get(revision).event);
      if (!sameEvent(original, event)) throw new Error('Stored signed bytes differ from the supplied event');
    } else {
      db.prepare('INSERT INTO announcements (revision, event_id, event) VALUES (?, ?, ?)')
        .run(revision, event.id, JSON.stringify(eventFields(event)));
      db.prepare('INSERT INTO announcement_members VALUES (?, ?)').run(revision, revision);
    }
    const evidence = historical ? JSON.stringify(historical.evidence) : null;
    if (evidence && db.prepare(`SELECT 1 FROM attempts WHERE announcement = ?
      AND status = 'imported' AND evidence = ?`).get(revision, evidence)) {
      return { id: event.id, status: 'delivered' };
    }
    db.prepare(`INSERT INTO attempts (announcement, started_at, sent_at, status, readbacks, acknowledgments, evidence)
      VALUES (?, ?, ?, 'imported', ?, ?, ?)`)
      .run(revision, clock(), event.created_at, JSON.stringify(outcomes),
        historical ? JSON.stringify(historical.acknowledgments) : null,
        evidence);
    db.prepare('UPDATE announcements SET delivered_at = coalesce(delivered_at, ?) WHERE revision = ?')
      .run(clock(), revision);
    return { id: event.id, status: 'delivered' };
  });
}

export function inspect(db, revision) {
  const release = requiredRelease(db, revision);
  const membership = db.prepare('SELECT announcement FROM announcement_members WHERE revision = ?').get(revision);
  if (!membership) return { release };
  const announcement = db.prepare('SELECT * FROM announcements WHERE revision = ?').get(membership.announcement);
  announcement.event = JSON.parse(announcement.event);
  announcement.approval = JSON.parse(announcement.approval);
  const attempts = db.prepare('SELECT * FROM attempts WHERE announcement = ? ORDER BY id').all(announcement.revision);
  for (const row of attempts) {
    for (const field of ['preflight', 'acknowledgments', 'readbacks', 'evidence']) row[field] = JSON.parse(row[field]);
  }
  return { release, announcement, attempts };
}

export function ready(db, now = unixNow()) {
  const used = db.prepare(`SELECT announcement, max(sent_at) AS last_send FROM attempts
    WHERE sent_at >= ? GROUP BY announcement ORDER BY last_send`).all(now - DAY);
  const active = new Set(db.prepare(`SELECT announcement FROM attempts WHERE started_at > ?
    AND status IN ('preflight', 'sending')`).all(now - ATTEMPT_LEASE).map(row => row.announcement));
  const approved = db.prepare(`SELECT revision, approved_at, event_id FROM announcements
    WHERE approval IS NOT NULL AND delivered_at IS NULL ORDER BY approved_at, revision LIMIT 100`).all();
  const awaitingReview = db.prepare(`SELECT r.revision, r.verified_at FROM releases r
    LEFT JOIN announcement_members m ON m.revision = r.revision
    WHERE m.revision IS NULL ORDER BY verified_at DESC, r.revision LIMIT 100`).all();
  return { usedInRollingDay: used.length,
    nextNewSlotAt: used.length >= 2 ? used[used.length - 2].last_send + DAY + 1 : now,
    approved: approved.map(row => ({ ...row, status: active.has(row.revision) ? 'active' :
      used.filter(send => send.announcement !== row.revision).length >= 2 ? 'daily-cap' : 'ready' })),
    awaitingReview };
}
