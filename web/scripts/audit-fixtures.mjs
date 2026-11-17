// Additional signed loopback events for owner audit interactions. No key material crosses the signer boundary.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
export async function auditFixtures({ fake, sign, owner, note }) {
  const peer = spawn('cargo', ['run', '-q', '-p', 'lkjstr-core', '--example', 'engine-fixtures'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  peer.stderr.resume();
  const lines = createInterface({ input: peer.stdout })[Symbol.asyncIterator]();
  const fixture = JSON.parse((await lines.next()).value);
  const now = Math.floor(Date.now() / 1000);
  const send = async (kind, content, tags = []) => {
    peer.stdin.write(
      `${JSON.stringify({ pubkey: fixture.note.pubkey, created_at: now, kind, content, tags })}\n`,
    );
    const event = JSON.parse((await lines.next()).value);
    fake.add(event);
    return event;
  };
  try {
    fake.add(fixture.events[0]);
    await send(7, '+', [
      ['e', note.id],
      ['p', owner],
    ]);
    await send(1, 'Audit reply from another fixture reader', [
      ['e', note.id, '', 'reply'],
      ['p', owner],
    ]);
    peer.stdin.write('{"fixtureRows":850}\n');
    for (const event of JSON.parse((await lines.next()).value)) fake.add(event);
    const creation = await sign({
      pubkey: owner,
      created_at: now,
      kind: 40,
      content: JSON.stringify({ name: 'Owner audit channel', about: 'Loopback only' }),
      tags: [],
    });
    fake.add(creation);
    fake.add(
      await sign({
        pubkey: owner,
        created_at: now,
        kind: 42,
        content: 'Audit channel history',
        tags: [['e', creation.id, '', 'root']],
      }),
    );
    fake.add(
      await sign({
        pubkey: owner,
        created_at: now,
        kind: 10000,
        content: '',
        tags: [['p', '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798']],
      }),
    );
    // Many actual notification rows, so the filter has content to scroll with.
    for (let n = 0; n < 20; n++)
      await send(1, `Audit reply ${n}`, [
        ['e', note.id, '', 'reply'],
        ['p', owner],
      ]);
  } finally {
    peer.stdin.end();
  }
}
