// Packs ../dist into ../tmp/lkjstr-dist.tar.gz, reproducibly (sorted names, zeroed times and owners), with
// index.html at the archive root, as the host's release tool expects.
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(new URL('..', import.meta.url).pathname, '..');
mkdirSync(join(root, 'tmp'), { recursive: true });
const tar = join(root, 'tmp', 'lkjstr-dist.tar.gz');
execSync(
  `tar --sort=name --mtime=@0 --owner=0 --group=0 --numeric-owner -C dist -cf - . | gzip -n > ${JSON.stringify(tar)}`,
  { cwd: root, stdio: 'inherit', shell: '/bin/sh' },
);
console.log(`ok package ${createHash('sha256').update(readFileSync(tar)).digest('hex')}`);
