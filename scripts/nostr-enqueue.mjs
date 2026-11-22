// Also executed as a self-contained snapshot by the canonical ship driver.
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const statePath = () => resolve(process.env.LKJSTR_SHIP_STATE_DIR ??
  join(homedir(), '.local/state'), 'lkjstr-nostr');
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const unixNow = () => Math.floor(Date.now() / 1000);
export const isHex = (text, size) => typeof text === 'string' && text.length === size && !/[^a-f0-9]/.test(text);

export function openState(directory) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const metadata = lstatSync(directory);
  if (!metadata.isDirectory() || metadata.uid !== process.getuid() || (metadata.mode & 0o077)) {
    throw new Error('Nostr state directory must be private and owned by this user');
  }
  const db = new DatabaseSync(join(directory, 'presence.sqlite3'), { timeout: 5000 });
  try {
    db.exec(`PRAGMA journal_mode = WAL;
      PRAGMA synchronous = FULL;
      CREATE TABLE IF NOT EXISTS releases (
        revision TEXT PRIMARY KEY,
        verified_at INTEGER NOT NULL,
        receipt TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS deployments (
        current TEXT PRIMARY KEY,
        revision TEXT NOT NULL REFERENCES releases,
        archive TEXT NOT NULL,
        verified_at INTEGER NOT NULL,
        receipt TEXT NOT NULL
      ) STRICT;`);
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

export function transaction(db, run) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = run();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function smallFile(path, maximum = 64 * 1024) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.size > maximum) throw new Error('Expected a bounded regular evidence file');
  const bytes = readFileSync(path);
  if (bytes.length > maximum) throw new Error('Evidence file exceeds its size limit');
  return bytes;
}

const goodHealth = (health, index) => health?.edge_https_content_headers_spa_compression === true &&
  health.external_dns_tls_browser_verified === false && health.served_index_sha256 === index;

function hostEvidence(run, slot, archive, index, expectedAfter, expectedBefore) {
  const deploy = smallFile(join(run, `deploy-${slot}.json`));
  const verify = smallFile(join(run, `verify-${slot}.json`));
  const body = JSON.parse(deploy);
  if (body.action !== 'deploy' || body.status !== 'passed' || body.archive_sha256 !== archive ||
      body.after !== expectedAfter || (expectedBefore && body.before !== expectedBefore) ||
      !goodHealth(body.health, index) || !goodHealth(JSON.parse(verify), index)) {
    throw new Error('Retained host receipts do not match the exact verified release');
  }
  return { deploy: deploy.toString('utf8'), verify: verify.toString('utf8'),
    deploySha256: sha256(deploy), verifySha256: sha256(verify) };
}

// Build the queue receipt from a retained ship run. Runs from before the hook carry no
// verified_at line, so their recovery supplies the time the run was verified.
export function shipReceipt(retainedRun, priorVerifiedAt) {
  const run = resolve(retainedRun);
  const summary = smallFile(join(run, 'summary'), 2048);
  const fields = Object.fromEntries(summary.toString('utf8').trimEnd().split('\n')
    .map(line => line.split('=', 2)));
  const { revision, archive, index, current, first, mode } = fields;
  const timestamp = fields.verified_at ?? priorVerifiedAt;
  const verifiedAt = Number(timestamp);
  if (!isHex(revision, 40) || !isHex(archive, 64) || !isHex(index, 64) ||
      !isHex(first, 32) || !isHex(current, 32) || !/^[0-9]+$/.test(timestamp ?? '') ||
      (fields.verified_at !== undefined && priorVerifiedAt !== undefined) ||
      !Number.isSafeInteger(verifiedAt) || verifiedAt <= 0 ||
      smallFile(join(run, 'revision'), 128).toString('utf8').trim() !== revision ||
      (mode === '' ? current !== first : mode !== '--establish-rollback-baseline' || current === first)) {
    throw new Error('Retained shipment summary does not identify a verified release');
  }
  const host = { first: hostEvidence(run, 'first', archive, index, first) };
  if (mode) host.baseline = hostEvidence(run, 'baseline', archive, index, current, first);
  return { revision, archive, index, current, first, mode, verifiedAt, run, host,
    origin: 'https://lkjstr.lkjsxc.com', summarySha256: sha256(summary) };
}

// The first receipt for a revision stays bound to its announcement. Every verified host
// deployment, including a later run of the same revision, keeps its own exact receipt.
export function insertRelease(db, receipt) {
  return transaction(db, () => {
    const text = JSON.stringify(receipt);
    const { changes } = db.prepare('INSERT OR IGNORE INTO releases VALUES (?, ?, ?)')
      .run(receipt.revision, receipt.verifiedAt, text);
    db.prepare('INSERT OR IGNORE INTO deployments VALUES (?, ?, ?, ?, ?)')
      .run(receipt.current, receipt.revision, receipt.archive, receipt.verifiedAt, text);
    const stored = db.prepare('SELECT revision, archive FROM deployments WHERE current = ?').get(receipt.current);
    if (stored.revision !== receipt.revision || stored.archive !== receipt.archive) {
      throw new Error('The host release ID already belongs to a different verified deployment');
    }
    return { revision: receipt.revision, queued: changes === 1, archive: receipt.archive, current: receipt.current };
  });
}

export function enqueue(directory, retainedRun, priorVerifiedAt) {
  const receipt = shipReceipt(retainedRun, priorVerifiedAt);
  const db = openState(directory);
  try {
    return insertRelease(db, receipt);
  } finally {
    db.close();
  }
}

if (import.meta.main || process.argv[1] === 'ship-nostr-enqueue') {
  try {
    if (process.argv.length !== 4) throw new Error('Expected state directory and retained ship run');
    const result = enqueue(process.argv[2], process.argv[3]);
    console.log(`Nostr release ${result.queued ? 'queued' : 'already queued'} ${result.revision}`);
  } catch {
    console.error('Nostr release evidence could not be queued from the retained ship run');
    process.exitCode = 1;
  }
}
