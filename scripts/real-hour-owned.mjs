// Optional public probes may attach only to an explicitly supplied, fresh owned run.
import { mkdir, realpath, readFile } from 'node:fs/promises';
import { resolve, dirname, basename, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
const inside = (base, path) => { const part = relative(base, path); return part !== '..' && !part.startsWith('../') && !isAbsolute(part); };
export async function ownedDirectory(root, requested, create = false) {
  if (!requested) throw Error('An explicit real:hour output directory is required');
  const actualRoot = await realpath(root), logicalBase = resolve(root, 'tmp');
  if (create) await mkdir(logicalBase, { recursive: true });
  const base = await realpath(logicalBase), logical = resolve(root, requested);
  if (!inside(actualRoot, base) || !inside(logicalBase, logical) || logical === logicalBase) throw Error('Measurement output must be inside this worktree tmp directory');
  const parent = await realpath(dirname(logical));
  if (!inside(base, parent)) throw Error('Measurement parent resolves outside owned tmp');
  const directory = resolve(parent, basename(logical));
  if (create) await mkdir(directory); // Existing runs and profiles are never reused.
  const actual = await realpath(directory);
  if (!inside(base, actual) || actual !== directory) throw Error('Measurement directory cannot be a symlink');
  return actual;
}
export async function validateOwnedRun(root, directory, report, source) {
  const owner = report.ownership;
  if (owner?.kind !== 'lkjstr-real-hour' || owner.directory !== directory || owner.root !== await realpath(root)
      || !/^[0-9a-f-]{36}$/.test(owner.id) || report.mode !== 'hour' || !report.cold?.readOnly)
    throw Error('The supplied artifact is not an owned read-only hour run');
  const hash = data => createHash('sha256').update(data).digest('hex');
  const companionHash = hash(await readFile(source));
  if (report.harnessHashes?.['real-hour-gap-audit.mjs'] !== companionHash) throw Error('Companion source differs from the run snapshot');
  if (hash(await readFile(`${directory}/bin/engine-public-verify`)) !== report.helperHashes?.['engine-public-verify']) throw Error('Native helper differs from the run snapshot');
  if (await realpath(`${directory}/profile`) !== `${directory}/profile`) throw Error('Owned browser profile cannot be a symlink');
  return { runId: owner.id, directory, mainStarted: report.started, liveStarted: report.liveStarted,
    revision: report.revision, build: report.build, helperHashes: report.helperHashes, companionHash };
}
