import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isHex, sha256, smallFile, transaction, unixNow } from '../nostr-enqueue.mjs';
import { HANDLER, ORIGIN } from './event.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const listedAt = '7b07411a0f9090c416987d8adbf8f537d6165606';
const listedEvent = '9dab8093f992ce59e13345f6a1c606b0f2e7c0c9a4561e4853cc2b0e9b40bcdf';
const routeFiles = ['web/src/shared/incoming-link.ts', 'crates/lkjstr-core/src/engine/wire/deep_links.rs',
  'docs/public-deep-links.md'];

export function requiredRelease(db, revision) {
  if (!isHex(revision, 40)) throw new Error('Expected a full source revision');
  const row = db.prepare('SELECT receipt FROM releases WHERE revision = ?').get(revision);
  if (!row) throw new Error('Source revision has no verified ship receipt');
  return JSON.parse(row.receipt);
}

function git(args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    throw new Error('Cannot read the exact release route sources from this checkout');
  }
}

function routeObjects(revision) {
  return git(['rev-parse', ...routeFiles.map(path => `${revision}:${path}`)]);
}

export function packet(db, release, batch) {
  if (!Array.isArray(batch) || batch.length > 12 || new Set([release, ...batch]).size !== batch.length + 1) {
    throw new Error('Expected unique primary and small-fix revisions');
  }
  const primary = requiredRelease(db, release);
  const fixes = batch.map(revision => requiredRelease(db, revision));
  if (fixes.some(fix => fix.verifiedAt > primary.verifiedAt ||
      primary.verifiedAt - fix.verifiedAt > 14 * 86400 ||
      git(['merge-base', fix.revision, release]) !== fix.revision)) {
    throw new Error('Batch members must be verified ancestors of the primary release from the last 14 days');
  }
  const knownRoutes = routeObjects(listedAt);
  const changed = routeObjects(release) !== knownRoutes;
  return { release: primary, batch: fixes, nip89: { address: HANDLER, listedEvent, listedAt, routeFiles, changed } };
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

export function stage(db, draftPath, reviewPath) {
  const bytes = smallFile(draftPath, 8192);
  const draft = JSON.parse(bytes);
  const review = JSON.parse(smallFile(reviewPath, 8192));
  const hash = sha256(bytes);
  if (!['neon', 'claude'].includes(draft.source) || !prose(draft.en, 1500) ||
      (draft.ja !== undefined && !prose(draft.ja, 2000)) || !evidence(draft.evidence)) {
    throw new Error('Expected reviewed EN and optional JA prose with writing evidence');
  }
  if (review.reviewer !== 'claude' || review.verdict !== 'approved' || review.draft_sha256 !== hash ||
      !['unchanged', 'reviewed'].includes(review.nip89) || !evidence(review.evidence)) {
    throw new Error('Expected Claude approval bound to the exact draft SHA-256 and a NIP-89 disposition');
  }
  const facts = packet(db, draft.release, draft.batch);
  if (facts.nip89.changed && review.nip89 !== 'reviewed') {
    throw new Error('Route sources changed since the listed NIP-89 handler and need review');
  }
  const content = [draft.en, draft.ja, ORIGIN].filter(Boolean).join('\n\n');
  const revisions = [draft.release, ...draft.batch];
  return transaction(db, () => {
    const existing = db.prepare('SELECT draft_sha256, event_id FROM announcements WHERE revision = ?').get(draft.release);
    if (existing?.draft_sha256 === hash) return { revision: draft.release, draftSha256: hash, alreadyStaged: true };
    if (existing?.event_id) throw new Error('An exact signed event already exists for this release');
    const used = db.prepare('SELECT announcement FROM announcement_members WHERE revision = ?');
    if (revisions.some(revision => {
      const row = used.get(revision);
      return row && row.announcement !== draft.release;
    })) throw new Error('A revision is already staged or announced in another release');
    db.prepare(`INSERT INTO announcements (revision, draft_sha256, approval, content, approved_at)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT (revision) DO UPDATE SET draft_sha256=excluded.draft_sha256,
      approval=excluded.approval, content=excluded.content, approved_at=excluded.approved_at`)
      .run(draft.release, hash, JSON.stringify({ draft: bytes.toString('utf8'),
        review: { reviewer: review.reviewer, verdict: review.verdict, draft_sha256: hash,
          nip89: review.nip89, evidence: review.evidence }, facts }), content, unixNow());
    db.prepare('DELETE FROM announcement_members WHERE announcement = ?').run(draft.release);
    const member = db.prepare('INSERT INTO announcement_members VALUES (?, ?)');
    for (const revision of revisions) member.run(revision, draft.release);
    return { revision: draft.release, draftSha256: hash, alreadyStaged: false };
  });
}
