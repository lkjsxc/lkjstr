import { enqueue, isHex, openState, readState, statePath } from './nostr-enqueue.mjs';
import { initOutbox, inspect, publish, ready, served } from './nostr/outbox.mjs';
import { packet, stage } from './nostr/review.mjs';
import { acknowledgeFeedback, listen } from './nostr/listen.mjs';

const commands = {
  enqueue: [1, 2], releases: [0, 0], ready: [0, 0], packet: [1, 1], stage: [2, 2],
  inspect: [1, 1], publish: [1, 1], served: [2, 2], listen: [0, 0], 'ack-feedback': [1, 40],
};
// These only read: they open the store read-only and never create its schema.
const readers = new Set(['releases', 'ready', 'packet', 'inspect', 'served']);

async function run(command, args) {
  if (!Object.hasOwn(commands, command) || args.length < commands[command][0] ||
      args.length > commands[command][1]) {
    throw new Error('Use enqueue, releases, ready, packet, stage, inspect, publish, served, listen or ack-feedback. See docs/nostr-operations.md.');
  }
  const directory = statePath();
  if (command === 'enqueue') return enqueue(directory, ...args);
  const reader = readers.has(command);
  const db = reader ? readState(directory) : openState(directory);
  try {
    if (!reader) initOutbox(db);
    switch (command) {
      case 'releases':
        return db.prepare(`SELECT r.revision, r.verified_at, m.announcement, a.event_id, a.delivered_at
          FROM releases r LEFT JOIN announcement_members m ON m.revision = r.revision
          LEFT JOIN announcements a ON a.revision = m.announcement ORDER BY verified_at DESC LIMIT 100`).all();
      case 'ready': return ready(db);
      case 'packet': return packet(db, args[0]);
      case 'stage': return stage(db, ...args);
      case 'inspect': return inspect(db, ...args);
      case 'publish': {
        const { signAnnouncement } = await import('./nostr/signer.mjs');
        return await publish(db, args[0], signAnnouncement);
      }
      case 'served':
        if (!isHex(args[0], 32) || !isHex(args[1], 64)) throw new Error('Expected a host release ID and archive SHA-256');
        return served(db, ...args);
      case 'listen': return await listen(db, directory);
      case 'ack-feedback': return acknowledgeFeedback(db, args);
    }
  } finally {
    db.close();
  }
}

try {
  const [command, ...args] = process.argv.slice(2);
  const result = await run(command, args);
  console.log(JSON.stringify(result, null, 2));
  if (result.status === 'unconfirmed') process.exitCode = 2;
} catch (error) {
  console.error(error.constructor === Error && !error.code ? error.message : 'Nostr operation failed while reading or writing evidence');
  process.exitCode = 1;
}
