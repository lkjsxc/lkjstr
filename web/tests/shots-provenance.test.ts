import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createShotWriter } from '../scripts/shots-provenance.ts';

it('pins each capture to its run commit and includes tracked and untracked changes', () => {
  const root = mkdtempSync(join(tmpdir(), 'lkjstr-shots-'));
  try {
    const git = (...args: string[]) =>
      execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
    const put = (path: string, value: string) => writeFileSync(join(root, path), value);
    git('init', '-q');
    put('.gitignore', 'ignored*\n');
    put('tracked', 'original');
    git('add', '.');
    git(
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.test',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '-qm',
      'fixture',
    );
    const commit = git('rev-parse', 'HEAD');
    const check = (writer: ReturnType<typeof createShotWriter>, dirty: boolean) => {
      const artifact = join(root, 'ignored.png');
      writer.stamp(artifact);
      expect(JSON.parse(readFileSync(`${artifact}.json`, 'utf8'))).toEqual({ commit, dirty });
    };
    put('ignored.png', 'capture');
    const clean = createShotWriter(root);
    check(clean, false);
    put('tracked', 'modified');
    check(createShotWriter(root), true);
    git('add', 'tracked');
    check(createShotWriter(root), true);
    git('reset', '--hard', 'HEAD');
    put('untracked', 'new file');
    check(createShotWriter(root), true);
    check(clean, false); // all artifacts from one run share the original snapshot
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
