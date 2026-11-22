import { resolve } from 'node:path';
import { sha256, smallFile } from '../nostr-enqueue.mjs';
import { RELAYS } from './event.mjs';

const acknowledgments = ['accepted', 'refused', 'timeout', 'connection-error', 'connection-closed', 'send-error'];
const readbacks = ['exact-event', 'no-exact-event-in-response', 'query-refused',
  'timeout', 'connection-error', 'connection-closed', 'send-error'];

export function legacyReceipt(path, event) {
  const bytes = smallFile(path, 16384);
  const rows = JSON.parse(bytes);
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > RELAYS.length ||
      rows.some(row => row?.kind !== 1 || row.id !== event?.id || !RELAYS.includes(row.relay) ||
        !acknowledgments.includes(row.acknowledgment) || !readbacks.includes(row.readback)) ||
      new Set(rows.map(row => row.relay)).size !== rows.length ||
      !rows.some(row => row.readback === 'exact-event')) {
    throw new Error('Legacy receipt does not report an exact readback of the supplied app event');
  }
  return {
    acknowledgments: rows.map(row => ({ relay: row.relay, status: row.acknowledgment })),
    readbacks: rows.map(row => ({ relay: row.relay, status: row.readback })),
    evidence: { path: resolve(path), sha256: sha256(bytes), original: bytes.toString('utf8') },
  };
}
