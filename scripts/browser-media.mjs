// Real loopback TLS/CORS fixture. Nothing is proxied to public media hosts.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { createServer } from 'node:https';
import { resolve } from 'node:path';
export async function fakeMedia() {
  const dir = await mkdtemp(resolve('tmp/temp/media-'));
  const cert = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', `${dir}/key.pem`, '-out', `${dir}/cert.pem`, '-days', '1', '-subj', '/CN=localhost'], { stdio: 'ignore' });
  if (cert.status !== 0) throw new Error('loopback TLS certificate failed');
  const tls = { key: await readFile(`${dir}/key.pem`), cert: await readFile(`${dir}/cert.pem`) };
  const requests = [], modes = { blossom: 'ok', nip96: 'ok' }, origins = {}, blobs = new Map();
  const servers = [];
  for (const protocol of ['blossom', 'nip96']) {
    const server = createServer(tls, async (req, res) => {
      const mode = modes[protocol], path = req.url;
      const headers = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, PUT, POST, OPTIONS', 'access-control-allow-headers': 'Authorization, Content-Type', 'access-control-max-age': '0', 'content-type': 'application/json' };
      if (requests.length >= 1000) requests.shift();
      const record = { protocol, method: req.method, path, mode };
      requests.push(record);
      if (req.method === 'OPTIONS') {
        record.allowed = mode !== 'cors';
        return void res.writeHead(204, mode === 'cors' ? {} : headers).end();
      }
      const reply = (status, value) => { if (!res.destroyed) res.writeHead(status, headers).end(JSON.stringify(value)); };
      if (path === '/.well-known/nostr/nip96.json') return reply(protocol === 'nip96' ? 200 : 404, { api_url: `${origins.nip96}/api` });
      if (protocol === 'nip96' && path === '/upload') return reply(404, {});
      if (path === '/processing') {
        const blob = blobs.get(protocol);
        return reply(201, { status: 'success', nip94_event: { tags: [['url', `${origins[protocol]}/${blob.hash}.png`], ['ox', blob.hash], ['m', 'image/png']] } });
      }
      if (req.method === 'GET') return void res.writeHead(200, { ...headers, 'content-type': 'image/png' }).end(blobs.get(protocol)?.bytes);
      if (mode === 'hang') return; // closed by AbortController; no fixture timer survives
      const chunks = []; for await (const data of req) chunks.push(data);
      const body = Buffer.concat(chunks);
      let auth; try { auth = JSON.parse(Buffer.from((req.headers.authorization ?? '').replace(/^Nostr /, ''), 'base64')); } catch { return reply(401, {}); }
      const tag = key => auth.tags?.find(t => t[0] === key)?.[1];
      let bytes = body;
      if (protocol === 'nip96') {
        const boundary = req.headers['content-type']?.match(/boundary=(.+)$/)?.[1];
        const start = body.indexOf('\r\n\r\n') + 4, end = body.indexOf(`\r\n--${boundary}`, start);
        if (!boundary || start < 4 || end < start || !body.includes(Buffer.from('name="file"'))) return reply(400, {});
        bytes = body.subarray(start, end);
      }
      const hash = createHash('sha256').update(bytes).digest('hex');
      const valid = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && /^Nostr /.test(req.headers.authorization ?? '') && auth.sig?.length === 128 &&
        Math.abs(auth.created_at - Date.now() / 1000) < 90 &&
        (protocol === 'blossom' ? req.method === 'PUT' && path === '/upload' && req.headers['content-type'] === 'image/png' && auth.kind === 24242 && tag('t') === 'upload' && tag('x') === hash && Number(tag('expiration')) > Date.now() / 1000 :
          req.method === 'POST' && path === '/api' && auth.kind === 27235 && tag('method') === 'POST' && tag('u') === `${origins.nip96}/api`);
      record.valid = valid;
      if (!valid) return reply(401, {});
      if (mode === 'refuse') return reply(403, { message: 'fixture refusal' });
      if (mode === 'paid') return reply(402, {});
      if (mode === 'malformed') return reply(201, { url: 'https://wrong.invalid/file' });
      blobs.set(protocol, { hash, bytes });
      if (mode === 'slow') await new Promise(done => setTimeout(done, 11000));
      if (mode === 'body-hang') { res.writeHead(201, headers); res.write('{'); return; }
      if (mode === 'processing') return reply(202, { status: 'processing', processing_url: `${origins.nip96}/processing` });
      reply(201, protocol === 'blossom' ? { url: `${origins[protocol]}/${hash}.png`, sha256: hash, type: 'image/png' } : { status: 'success', nip94_event: { tags: [['url', `${origins[protocol]}/${hash}.png`], ['ox', hash], ['m', 'image/png']] } });
    });
    await new Promise(done => server.listen(0, '127.0.0.1', done));
    origins[protocol] = `https://127.0.0.1:${server.address().port}`;
    servers.push(server);
  }
  return { origins, requests, set(protocol, mode) { modes[protocol] = mode; }, async close() { for (const server of servers) { server.closeAllConnections(); await new Promise(done => server.close(done)); } } };
}

// Each concurrent signer scenario owns its response modes and unique ports.
export async function fakeMediaSet() {
  const groups = [];
  for (const signer of ['local', 'extension', 'remote']) groups.push([signer, await fakeMedia()]);
  return {
    bySigner: Object.fromEntries(groups),
    origins: Object.fromEntries(groups.flatMap(([signer, media]) => Object.entries(media.origins).map(([protocol, url]) => [`${signer}-${protocol}`, url]))),
    async close() { await Promise.all(groups.map(([, media]) => media.close())); },
  };
}
