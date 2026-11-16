// Owned loopback signers only. Secret scalars remain inside the Rust helpers.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { resolve, join } from 'node:path';
async function bounded(promise, ms = 15_000) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('owned fixture helper timeout')), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
async function helper(name) {
  const target = resolve(process.env.CARGO_TARGET_DIR ?? 'target');
  const child = spawn(join(target, 'debug/examples', name), [], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  child.stderr.resume();
  const exited = new Promise((ok) => child.once('exit', ok));
  const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
  const first = JSON.parse((await bounded(lines.next())).value);
  let chain = Promise.resolve();
  return {
    first,
    call(input) {
      const next = chain.then(async () => {
        child.stdin.write(JSON.stringify(input) + '\n');
        return JSON.parse((await bounded(lines.next())).value);
      });
      chain = next.catch(() => {});
      return next;
    },
    async close() {
      await chain;
      child.stdin.end();
      try {
        await bounded(exited, 2000);
      } catch {
        child.kill('SIGTERM');
        await bounded(exited, 2000);
      }
    },
  };
}
export async function signerFixtures() {
  const extension = await helper('engine-fixtures'),
    remote = await helper('engine-bunker');
  const pubkey = remote.first.pubkey,
    calls = [],
    held = [],
    sockets = new Set();
  let mode = {};
  const relay = (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    let sub;
    socket.on('message', (raw) => {
      const msg = JSON.parse(String(raw));
      if (msg[0] === 'REQ') sub = msg[1];
      if (msg[0] !== 'EVENT') return;
      const selected = { ...mode };
      void remote
        .call({
          event: msg[1],
          refuse_crypto: selected.error,
          refuse_sign_error: selected.signError,
        })
        .then((reply) => {
          const privateCall = /^(nip44|nip04)_/.test(reply.method);
          if (calls.length >= 1000) throw new Error('bounded signer call fixture overflow');
          calls.push({
            at: Date.now(),
            method: reply.method,
            client: msg[1].pubkey,
            id: msg[1].id,
          });
          if (reply.method === 'sign_event' && selected.closeSign) {
            socket.close();
          } else if (
            (privateCall && selected.hold) ||
            (reply.method === 'sign_event' && selected.holdSign)
          ) {
            if (held.length >= 32) throw new Error('bounded held signer fixture overflow');
            held.push({ socket, sub, request: msg[1], reply: reply.event });
          } else if (socket.readyState === 1)
            socket.send(JSON.stringify(['EVENT', sub, reply.event]));
        })
        .catch((error) => {
          socket.close();
          calls.push({ fixtureError: String(error) });
        });
    });
  };
  return {
    extension,
    pubkey,
    calls,
    relay,
    mode(value) {
      mode = value;
    },
    connections: () => sockets.size,
    held: () => held.length,
    heldIds: () => held.map((entry) => entry.request.id),
    openHeld: (ids) =>
      held.filter((entry) => ids.includes(entry.request.id) && entry.socket.readyState === 1)
        .length,
    async release(error, ids) {
      const selected = held.filter((entry) => !ids || ids.includes(entry.request.id));
      for (const entry of selected) {
        held.splice(held.indexOf(entry), 1);
        const event = error
          ? (
              await remote.call({
                event: entry.request,
                refuse_crypto: error,
                refuse_sign_error: error,
              })
            ).event
          : entry.reply;
        if (entry.socket.readyState === 1)
          entry.socket.send(JSON.stringify(['EVENT', entry.sub, event]));
      }
    },
    fixture(kind, tags, created_at) {
      return remote.call({ fixture: { pubkey, kind, tags, created_at, content: '' } });
    },
    async close() {
      for (const socket of sockets) socket.close();
      held.length = 0;
      await Promise.allSettled([extension.close(), remote.close()]);
    },
  };
}
