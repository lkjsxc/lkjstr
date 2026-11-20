// Chromium keeps its singleton socket in a directory under TMPDIR, and a Unix socket path holds at most 107 bytes,
// so a checkout at a long path cannot give the browser a temporary directory under its own tmp/: the launch dies with
// "Target page, context or browser has been closed". Only then, a short symlink in the system's /tmp spells the same
// directory. The files stay in the checkout, every output directory is unchanged, and the link goes when the process
// exits.
import { mkdirSync, mkdtempSync, rmdirSync, symlinkSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

/** The longest Unix socket path, and what Chromium adds under TMPDIR for its socket. */
const LIMIT = 107;
const ADDED = Buffer.byteLength('/org.chromium.Chromium.XXXXXX/SingletonSocket');

/** `dir`, made if missing; or, when Chromium's socket under it (and `room` more bytes the caller adds below it)
 * would be too long, a short link to it that is removed when this process exits. */
export function browserTmp(dir: string, room = 0): string {
  mkdirSync(dir, { recursive: true });
  if (Buffer.byteLength(dir) + room + ADDED <= LIMIT) return dir;
  const holder = mkdtempSync('/tmp/lkjstr-');
  const link = join(holder, 't');
  symlinkSync(dir, link);
  process.once('exit', () => {
    try {
      unlinkSync(link);
      rmdirSync(holder);
    } catch {
      // Already gone.
    }
  });
  return link;
}
