// Pack the existing real build reproducibly, with index.html at the archive root.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(new URL('..', import.meta.url).pathname, '..');
mkdirSync(join(root, 'tmp'), { recursive: true });
const tar = join(root, 'tmp', 'lkjstr-dist.tar.gz');
const raw = execFileSync(
  'tar',
  [
    '--sort=name',
    '--mtime=@0',
    '--owner=0',
    '--group=0',
    '--numeric-owner',
    '-C',
    'dist',
    '-cf',
    '-',
    '.',
  ],
  { cwd: root, maxBuffer: 128 * 1024 * 1024 },
);
// Validate the exact archive, including directory entries, before publishing it locally.
execFileSync('python3', ['-I', join(root, 'web/scripts/package-check.py')], {
  input: raw,
  stdio: ['pipe', 'pipe', 'inherit'],
});
const bytes = execFileSync('gzip', ['-n'], { input: raw, maxBuffer: 128 * 1024 * 1024 });
writeFileSync(tar, bytes);
console.log(`ok package ${createHash('sha256').update(bytes).digest('hex')} ${bytes.length} bytes`);
