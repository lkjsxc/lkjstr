import { transaction, unixNow } from '../nostr-enqueue.mjs';
import { RELAYS, eventFields, sameEvent, validEvent } from './event.mjs';
import { coverage, sourceGit, undescribed } from './coverage.mjs';
import { requiredRelease } from './review.mjs';
import { readRelay, sendRelay } from './relay.mjs';

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
    CREATE TABLE IF NOT EXISTS coverage (
      announcement TEXT PRIMARY KEY REFERENCES announcements,
      since TEXT
    ) STRICT;
    CREATE TABLE IF NOT EXISTS attempts (
      id INTEGER PRIMARY KEY,
      announcement TEXT NOT NULL REFERENCES announcements,
      started_at INTEGER NOT NULL, sent_at INTEGER, status TEXT NOT NULL,
      preflight TEXT, acknowledgments TEXT, readbacks TEXT, evidence TEXT
    ) STRICT;
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

// The send fence: an attempt that still holds its lease is marked sending before any relay sees the event.
function reserve(db, id, now) {
  transaction(db, () => {
    if (!db.prepare(`SELECT 1 FROM attempts WHERE id = ? AND status = 'preflight' AND started_at > ?`)
      .get(id, now - ATTEMPT_LEASE)) {
      throw new Error('Announcement attempt lost its lease before send');
    }
    db.prepare("UPDATE attempts SET sent_at = ?, status = 'sending' WHERE id = ?").run(now, id);
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
  reserve(db, id, clock());
  const acknowledgments = await Promise.all(relays.map(relay => send(relay, event)));
  db.prepare('UPDATE attempts SET acknowledgments = ? WHERE id = ?').run(JSON.stringify(acknowledgments), id);
  const after = await readback(relays, event, read);
  return { id: event.id, status: finish(db, revision, id, after, clock()) };
}

export function inspect(db, revision) {
  const release = requiredRelease(db, revision);
  const membership = db.prepare('SELECT announcement FROM announcement_members WHERE revision = ?').get(revision);
  if (!membership) return { release };
  const announcement = db.prepare('SELECT * FROM announcements WHERE revision = ?').get(membership.announcement);
  announcement.event = JSON.parse(announcement.event);
  announcement.approval = JSON.parse(announcement.approval);
  announcement.coverage = db.prepare('SELECT since FROM coverage WHERE announcement = ?').get(announcement.revision);
  const attempts = db.prepare('SELECT * FROM attempts WHERE announcement = ? ORDER BY id').all(announcement.revision);
  for (const row of attempts) {
    for (const field of ['preflight', 'acknowledgments', 'readbacks', 'evidence']) row[field] = JSON.parse(row[field]);
  }
  return { release, announcement, attempts };
}

export function served(db, current, archive) {
  const row = db.prepare('SELECT revision, verified_at FROM deployments WHERE current = ? AND archive = ?')
    .get(current, archive);
  return row ? { queued: true, revision: row.revision, verifiedAt: row.verified_at } : { queued: false };
}

// `next` is the newest verified release when it can carry the next note: it has no announcement of its own and
// source in its history that no staged or delivered note describes. `awaitingReview` lists every such release.
export function ready(db, { git = sourceGit(), now = unixNow() } = {}) {
  const active = new Set(db.prepare(`SELECT announcement FROM attempts WHERE started_at > ?
    AND status IN ('preflight', 'sending')`).all(now - ATTEMPT_LEASE).map(row => row.announcement));
  const approved = db.prepare(`SELECT revision, approved_at, event_id FROM announcements
    WHERE approval IS NOT NULL AND delivered_at IS NULL ORDER BY approved_at, revision`).all();
  const described = coverage(db);
  const releases = db.prepare('SELECT revision, verified_at FROM releases ORDER BY verified_at DESC, revision').all();
  const awaitingReview = [];
  for (const row of releases) {
    let count = null;
    try {
      count = undescribed(git, row.revision, described).length;
    } catch {
      // An unreadable revision stays listed with an unknown count until its source is fetched.
    }
    if (count !== 0) awaitingReview.push({ ...row, undescribed: count });
  }
  const newest = releases[0]?.revision;
  const own = newest && db.prepare('SELECT 1 FROM announcements WHERE revision = ?').get(newest);
  return {
    next: newest && !own && awaitingReview[0]?.revision === newest ? newest : null,
    awaitingReview,
    approved: approved.map(row => ({ ...row, status: active.has(row.revision) ? 'active' : 'ready' })),
  };
}
