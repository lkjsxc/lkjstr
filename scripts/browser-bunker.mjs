// Loopback NIP-46 fixture. Keys and decrypted RPC payloads stay in Rust.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
export async function fakeBunker() {
  const child = spawn('cargo', ['run', '-q', '-p', 'lkjstr-core', '--example', 'engine-bunker'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  child.stderr.resume();
  const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
  const { pubkey } = JSON.parse((await lines.next()).value);
  const sockets = new Set(); // bounded by this test's outstanding RPCs
  const calls = [];
  let online = true, refused = false, holding = false, waiting = 0, chain = Promise.resolve();
  const route = (socket, requireSecret = false) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    if (!online) { socket.close(); return; }
    let sub;
    socket.on('message', (raw) => {
      const msg = JSON.parse(String(raw));
      if (msg[0] === 'REQ') sub = msg[1];
      if (msg[0] === 'EVENT' && holding) { waiting++; return; }
      if (msg[0] === 'EVENT') chain = chain.then(async () => {
        child.stdin.write(`${JSON.stringify({ event: msg[1], require_secret: requireSecret, refuse_sign: refused })}\n`);
        const reply = JSON.parse((await lines.next()).value);
        calls.push({ method: reply.method, authorized: reply.authorized, client: msg[1].pubkey });
        if (online && socket.readyState === 1)
          socket.send(JSON.stringify(['EVENT', sub, reply.event]));
      });
    });
  };
  return {
    pubkey, route, calls,
    async fixture(kind,tags,created_at) {
      let result;
      chain=chain.then(async()=>{
        child.stdin.write(`${JSON.stringify({fixture:{pubkey,kind,tags,created_at,content:''}})}\n`);
        result=JSON.parse((await lines.next()).value);
      });
      await chain;return result;
    },
    down() { online = false; for (const socket of sockets) socket.close(); },
    up() { online = true; },
    refuse(value) { refused = value; },
    hold(value) { holding = value; waiting = 0; },
    waiting: () => waiting,
    connections: () => sockets.size,
    async close() { for (const socket of sockets) socket.close(); await chain; child.stdin.end(); },
  };
}
