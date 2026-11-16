// No browser/network access: prove the companion cannot discover or reuse profiles.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { ownedDirectory, validateOwnedRun } from './real-hour-owned.mjs';
test('owned output rejects reuse, outside paths and symlink escapes', async () => {
  const root = await mkdtemp(resolve('tmp/real-hour-owned-test-'));
  try {
    await mkdir(`${root}/tmp`); await mkdir(`${root}/elsewhere`);
    const directory = await ownedDirectory(root, 'tmp/run', true);
    assert.equal(directory, `${root}/tmp/run`);
    await assert.rejects(ownedDirectory(root, 'tmp/run', true), /EEXIST/);
    await assert.rejects(ownedDirectory(root, 'elsewhere/run', true), /inside/);
    await symlink(`${root}/elsewhere`, `${root}/tmp/escape`);
    await assert.rejects(ownedDirectory(root, 'tmp/escape/run', true), /outside/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('companion requires exact owned artifact and helper identity before attachment', async () => {
  const root = await mkdtemp(resolve('tmp/real-hour-owned-test-'));
  try {
    await mkdir(`${root}/tmp`);
    const directory = await ownedDirectory(root, 'tmp/run', true);
    await mkdir(`${directory}/profile`); await mkdir(`${directory}/bin`);
    const source = `${directory}/companion.mjs`, helper = `${directory}/bin/engine-public-verify`;
    await writeFile(source, 'owned source'); await writeFile(helper, 'owned helper');
    const hash = text => createHash('sha256').update(text).digest('hex');
    const report = { ownership: { kind: 'lkjstr-real-hour', id: randomUUID(), root, directory }, mode: 'hour', cold: { readOnly: true },
      harnessHashes: { 'real-hour-gap-audit.mjs': hash('owned source') }, helperHashes: { 'engine-public-verify': hash('owned helper') } };
    await assert.rejects(validateOwnedRun(root, directory, {}, source), /not an owned/);
    assert.equal((await validateOwnedRun(root, directory, report, source)).runId, report.ownership.id);
    await writeFile(helper, 'different helper');
    await assert.rejects(validateOwnedRun(root, directory, report, source), /helper differs/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
