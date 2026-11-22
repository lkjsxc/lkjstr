import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const checkout = fileURLToPath(new URL('../../', import.meta.url));
const git = { encoding: 'utf8', timeout: 10000, maxBuffer: 16 * 1024 * 1024 };

// Read-only Git access to the exact release sources. `ancestor` answers merge-base --is-ancestor.
export function sourceGit(root = checkout) {
  const run = args => {
    try {
      return execFileSync('git', args, { ...git, cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
      throw new Error('Cannot read the exact release sources from this checkout; fetch them first');
    }
  };
  run.ancestor = (older, newer) => {
    const { status } = spawnSync('git', ['merge-base', '--is-ancestor', older, newer],
      { ...git, cwd: root, stdio: 'ignore' });
    if (status !== 0 && status !== 1) throw new Error('Cannot compare release sources in this checkout');
    return status === 0;
  };
  return run;
}

// What each staged or delivered note describes: all source reachable from its release, or, when an earlier
// note described less, only the source after `since`. Without a row an announcement's scope is unknown.
export function coverage(db, except) {
  const rows = db.prepare(`SELECT a.revision, c.announcement, c.since FROM announcements a
    LEFT JOIN coverage c ON c.announcement = a.revision ORDER BY a.revision`).all()
    .filter(row => row.revision !== except);
  if (rows.some(row => !row.announcement)) {
    throw new Error('An announcement has no recorded coverage; run the one-time coverage backfill');
  }
  return rows.map(({ revision, since }) => ({ announcement: revision, since }));
}

const commitLines = text => text.split('\n').filter(Boolean).map(line => {
  const [revision, ...subject] = line.split(' ');
  return { revision, subject: subject.join(' ') };
});

// Commits in `revision`'s history, oldest first, that no recorded note describes.
export function undescribed(git, revision, described) {
  const whole = described.filter(row => row.since === null).map(row => row.announcement);
  const commits = commitLines(git(['log', '--topo-order', '--reverse', '--format=%H %s',
    revision, '--not', ...whole]));
  const partial = new Set(described.filter(row => row.since !== null).flatMap(row =>
    git(['rev-list', row.announcement, '--not', row.since]).split('\n').filter(Boolean)));
  return commits.filter(commit => !partial.has(commit.revision));
}

// Commits in `revision`'s history not described by a whole-history note, for grouping gaps by release.
export function history(git, revision, described) {
  const whole = described.filter(row => row.since === null).map(row => row.announcement);
  return new Set(git(['rev-list', revision, '--not', ...whole]).split('\n').filter(Boolean));
}
