// Native signer fixture for measurement tests. Only public synthetic events leave the helper.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { resolve, join } from 'node:path';
export async function historicalFixture() {
  const bin = resolve(process.env.LKJSTR_ENGINE_FIXTURE_BIN ?? join(process.env.CARGO_TARGET_DIR ?? 'target', 'debug/examples/engine-fixtures'));
  const child = spawn(bin, [], { stdio: ['pipe', 'pipe', 'pipe'] }); child.stderr.resume();
  child.stdin.on('error', () => {});
  const ended = new Promise(ok => { child.once('exit', ok); child.once('error', ok); });
  const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
  const read = async () => {
    let timer;
    try { return JSON.parse((await Promise.race([lines.next(), new Promise((_, no) => {
      timer = setTimeout(() => no(Error('owned signing fixture timeout')), 5000);
    })])).value); } finally { clearTimeout(timer); }
  };
  const ask = value => { child.stdin.write(JSON.stringify(value) + '\n'); return read(); };
  const sign = (pubkey, kind, created_at, tags, content) => ask({ pubkey, kind, created_at, tags, content });
  try {
    const initial = await read(), owner = initial.note.pubkey;
    const actor = await ask({ fixtureActor: true }), muted = await ask({ fixtureActor: true });
    const now = Math.floor(Date.now() / 1000), span = { since: now - 7 * 86400, until: now - 1 };
    const follow = await sign(owner, 3, now - 4000, [['p', actor.pubkey]], '');
    const mute = await sign(owner, 10000, now - 3900, [['p', muted.pubkey]], '');
    const focus = await sign(actor.pubkey, 1, now - 3600, [], 'Owned historical focus');
    const tags = [['p', owner], ['e', focus.id, '', 'reply']];
    const first = await sign(actor.pubkey, 1, now - 3500, tags, 'Owned direct reply one');
    const second = await sign(actor.pubkey, 1, now - 3400, tags, 'Owned direct reply two');
    const mention = await sign(actor.pubkey, 1, now - 3300, [['p', owner]], 'Owned text mention');
    const quote = await sign(actor.pubkey, 1, now - 3200, [['p', owner], ['e', focus.id, '', 'mention']], 'Owned reference only');
    const reaction = await sign(actor.pubkey, 7, now - 3100, [['p', owner], ['e', focus.id]], '+');
    const own = await sign(owner, 1, now - 3000, [['p', owner]], 'Owned self notification');
    const hidden = await sign(muted.pubkey, 1, now - 2900, [['p', owner]], 'Owned muted notification');
    const outside = await sign(actor.pubkey, 1, now - 8 * 86400, [['p', owner]], 'Owned older note');
    const invalid = { ...await sign(actor.pubkey, 1, now - 2800, [['p', owner]], 'Owned invalid signature'), sig: '0'.repeat(128) };
    return { bin, owner, actor: actor.pubkey, follow, mute, focus, first, second, mention, quote, reaction, own, hidden, outside, invalid, span,
      events: [follow, mute, focus, first, second, mention, quote, reaction, own, hidden, outside, invalid] };
  } finally {
    child.stdin.end(); let timer;
    try { await Promise.race([ended, new Promise(ok => { timer = setTimeout(() => { child.kill('SIGKILL'); ok(); }, 2000); })]); }
    finally { clearTimeout(timer); await ended; }
  }
}
