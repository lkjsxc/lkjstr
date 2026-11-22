import { isHex, sha256, smallFile, transaction, unixNow } from '../nostr-enqueue.mjs';
import { coverage, history, sourceGit, undescribed } from './coverage.mjs';
import { HANDLER, ORIGIN } from './event.mjs';

export const LISTING = { at: '7b07411a0f9090c416987d8adbf8f537d6165606',
  event: '9dab8093f992ce59e13345f6a1c606b0f2e7c0c9a4561e4853cc2b0e9b40bcdf' };
const routeFiles = ['web/src/shared/incoming-link.ts', 'crates/lkjstr-core/src/engine/wire/deep_links.rs',
  'docs/public-deep-links.md'];

export function requiredRelease(db, revision) {
  if (!isHex(revision, 40)) throw new Error('Expected a full source revision');
  const row = db.prepare('SELECT receipt FROM releases WHERE revision = ?').get(revision);
  if (!row) throw new Error('Source revision has no verified ship receipt');
  return JSON.parse(row.receipt);
}

const routeObjects = (git, revision) => git(['rev-parse', ...routeFiles.map(path => `${revision}:${path}`)]);

// The release this deployment replaced on the host, when that one is queued too.
function replaced(db, receipt) {
  const before = JSON.parse(receipt.host.first.deploy).before;
  return db.prepare('SELECT revision FROM deployments WHERE current = ?').get(before ?? '')?.revision ?? null;
}

// Everything a note for `release` must describe: each queued deployment in its history that still has
// undescribed source, including omissions older than the last delivered note, oldest first.
function gaps(db, git, release, described) {
  const remaining = new Map(undescribed(git, release, described).map(commit => [commit.revision, commit]));
  const member = db.prepare('SELECT announcement FROM announcement_members WHERE revision = ?');
  const found = [];
  for (const { revision } of db.prepare('SELECT revision FROM releases ORDER BY verified_at, revision').all()) {
    if (!remaining.size) break;
    if (revision !== release && !git.ancestor(revision, release)) continue;
    const inside = history(git, revision, described);
    const commits = [...remaining.values()].filter(commit => inside.has(commit.revision));
    if (!commits.length) continue;
    for (const commit of commits) remaining.delete(commit.revision);
    const receipt = requiredRelease(db, revision);
    const owner = member.get(revision)?.announcement;
    found.push({ release: revision, verifiedAt: receipt.verifiedAt, archive: receipt.archive,
      current: receipt.current, replaced: replaced(db, receipt),
      announcement: owner && owner !== release ? owner : null, commits });
  }
  return found;
}

export function packet(db, release, { git = sourceGit(), listing = LISTING } = {}) {
  const primary = requiredRelease(db, release);
  const described = coverage(db, release);
  const last = db.prepare(`SELECT a.revision, a.event_id, a.delivered_at, c.since FROM announcements a
    JOIN coverage c ON c.announcement = a.revision WHERE a.delivered_at IS NOT NULL AND a.revision != ?
    ORDER BY a.delivered_at DESC, a.revision LIMIT 1`).get(release);
  const found = gaps(db, git, release, described);
  const facts = {
    release: primary,
    lastDelivered: last ? { announcement: last.revision, eventId: last.event_id,
      deliveredAt: last.delivered_at, since: last.since } : null,
    described,
    gaps: found,
    batch: found.filter(gap => gap.release !== release && !gap.announcement).map(gap => gap.release),
    nip89: { address: HANDLER, listedEvent: listing.event, listedAt: listing.at, routeFiles,
      changed: routeObjects(git, release) !== routeObjects(git, listing.at) },
  };
  return { sha256: sha256(JSON.stringify(facts)), ...facts };
}

function prose(value, limit) {
  return typeof value === 'string' && value.length && value === value.trim() && Buffer.byteLength(value) <= limit &&
    !/[\p{Cc}\p{Cf}]/u.test(value.replaceAll('\n', '')) && !/nsec1[0-9a-z]+/i.test(value) &&
    !/:\/\/|\bwww\.|\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|app|dev)(?:\W|$)/i.test(value);
}

function evidence(value) {
  return typeof value === 'string' && value.trim() && value.length <= 512 &&
    !/[\p{Cc}\p{Cf}]/u.test(value) && !/nsec1[0-9a-z]+/i.test(value);
}

export function stage(db, draftPath, reviewPath, options) {
  const bytes = smallFile(draftPath, 8192);
  const draft = JSON.parse(bytes);
  const review = JSON.parse(smallFile(reviewPath, 8192));
  const hash = sha256(bytes);
  if (!['neon', 'claude'].includes(draft.source) || !prose(draft.en, 1500) ||
      (draft.ja !== undefined && !prose(draft.ja, 2000)) || !evidence(draft.evidence) ||
      !Array.isArray(draft.batch) || !draft.batch.every(revision => isHex(revision, 40))) {
    throw new Error('Expected reviewed EN and optional JA prose, the packet batch and writing evidence');
  }
  if (review.reviewer !== 'claude' || review.verdict !== 'approved' || review.draft_sha256 !== hash ||
      !isHex(review.packet_sha256, 64) || !['unchanged', 'reviewed'].includes(review.nip89) ||
      !evidence(review.evidence)) {
    throw new Error('Expected Claude approval bound to the exact draft and packet SHA-256 and a NIP-89 disposition');
  }
  const content = [draft.en, draft.ja, ORIGIN].filter(Boolean).join('\n\n');
  return transaction(db, () => {
    const existing = db.prepare('SELECT draft_sha256, event_id FROM announcements WHERE revision = ?').get(draft.release);
    if (existing?.draft_sha256 === hash) return { revision: draft.release, draftSha256: hash, alreadyStaged: true };
    if (existing?.event_id) throw new Error('An exact signed event already exists for this release');
    const facts = packet(db, draft.release, options);
    if (facts.sha256 !== review.packet_sha256) {
      throw new Error('The review is bound to a different release packet; review the current packet');
    }
    if (!facts.gaps.length) throw new Error('Nothing in this release is left to announce');
    if (JSON.stringify(draft.batch) !== JSON.stringify(facts.batch)) {
      throw new Error('The draft batch must list exactly the packet batch, oldest first');
    }
    if (facts.nip89.changed && review.nip89 !== 'reviewed') {
      throw new Error('Route sources changed since the listed NIP-89 handler and need review');
    }
    db.prepare(`INSERT INTO announcements (revision, draft_sha256, approval, content, approved_at)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT (revision) DO UPDATE SET draft_sha256=excluded.draft_sha256,
      approval=excluded.approval, content=excluded.content, approved_at=excluded.approved_at`)
      .run(draft.release, hash, JSON.stringify({ draft: bytes.toString('utf8'),
        review: { reviewer: review.reviewer, verdict: review.verdict, draft_sha256: hash,
          packet_sha256: review.packet_sha256, nip89: review.nip89, evidence: review.evidence }, facts }),
      content, unixNow());
    db.prepare('DELETE FROM announcement_members WHERE announcement = ?').run(draft.release);
    const member = db.prepare('INSERT INTO announcement_members VALUES (?, ?)');
    for (const revision of [draft.release, ...draft.batch]) member.run(revision, draft.release);
    db.prepare('INSERT INTO coverage VALUES (?, NULL) ON CONFLICT (announcement) DO UPDATE SET since = NULL')
      .run(draft.release);
    return { revision: draft.release, draftSha256: hash, alreadyStaged: false };
  });
}
