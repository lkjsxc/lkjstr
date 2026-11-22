import { constants, openSync, fstatSync, readSync, closeSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { schnorr } from '@noble/curves/secp256k1.js';
import { bech32 } from '@scure/base';
import { APP, eventDigest, validEvent } from './event.mjs';

function* strings(value) {
  if (typeof value === 'string') yield value;
  else if (value && typeof value === 'object') {
    for (const nested of Object.values(value)) yield* strings(nested);
  }
}

function keyBytes(text) {
  if (/^[a-f0-9]{64}$/i.test(text)) return Buffer.from(text, 'hex');
  if (!text.startsWith('nsec1')) return;
  const decoded = bech32.decode(text, 90);
  if (decoded.prefix === 'nsec') return Buffer.from(bech32.fromWords(decoded.words));
}

function keyForApp() {
  const path = join(homedir(), '.local/state/crew/secrets/lkjstr-nostr.json');
  const bytes = Buffer.alloc(4097);
  let fd;
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o600) {
      throw new Error();
    }
    let length = 0;
    while (length < bytes.length) {
      const count = readSync(fd, bytes, length, bytes.length - length);
      if (!count) break;
      length += count;
    }
    if (length === bytes.length) throw new Error();
    for (const text of strings(JSON.parse(bytes.toString('utf8', 0, length)))) {
      let key;
      try {
        key = keyBytes(text);
        if (key?.length === 32 && Buffer.from(schnorr.getPublicKey(key)).toString('hex') === APP) return key;
      } catch {
        // Ignore unrelated fields in the private fixture.
      }
      key?.fill(0);
    }
  } catch {
    // File, parse and cryptographic errors can contain secret input.
  } finally {
    bytes.fill(0);
    if (fd !== undefined) closeSync(fd);
  }
  throw new Error('Private signer could not load the expected app key');
}

// Called only by an explicit publish command for an approved kind-1 draft.
export function signAnnouncement(content, revision, now) {
  const secret = keyForApp();
  try {
    const event = { pubkey: APP, kind: 1, created_at: now, tags: [['r', `https://github.com/lkjsxc/lkjstr/commit/${revision}`]], content };
    const digest = eventDigest(event);
    event.id = digest.toString('hex');
    event.sig = Buffer.from(schnorr.sign(digest, secret)).toString('hex');
    if (!validEvent(event)) throw new Error();
    return event;
  } catch {
    throw new Error('Private signer could not sign the approved announcement');
  } finally {
    secret.fill(0);
  }
}
