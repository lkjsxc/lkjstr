// Real loopback TLS/CORS fixture. Nothing is proxied to public media hosts.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:https';
import { resolve } from 'node:path';
export async function fakeMedia() {
  await mkdir(resolve('tmp/temp'), { recursive: true });
  const dir = await mkdtemp(resolve('tmp/temp/media-'));
  const servers = [];
  const close = async () => {
    try { for (const server of servers) { server.closeAllConnections(); await new Promise(done => server.close(() => done())); } }
    finally { await rm(dir, { recursive: true, force: true }); }
  };
  try {
  const cert = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', `${dir}/key.pem`, '-out', `${dir}/cert.pem`, '-days', '1', '-subj', '/CN=localhost'], { stdio: 'ignore' });
  if (cert.status !== 0) throw new Error('loopback TLS certificate failed');
  const tls = { key: await readFile(`${dir}/key.pem`), cert: await readFile(`${dir}/cert.pem`) };
  const requests = [], modes = { blossom: 'ok', nip96: 'ok' }, origins = {}, blobs = new Map();
  const holds = new Map();
  for (const protocol of ['blossom', 'nip96']) {
    const server = createServer(tls, async (req, res) => {
      const hold = holds.get(protocol);
      let mode = modes[protocol];
      const path = req.url;
      const headers = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, PUT, POST, OPTIONS', 'access-control-allow-headers': 'Authorization, Content-Type', 'access-control-max-age': '0', 'content-type': 'application/json' };
      if (requests.length >= 1000) requests.shift();
      const record = { protocol, method: req.method, path, mode: hold ? 'held' : mode, closed: false, complete: false, aborted: false };
      req.on('aborted', () => { record.aborted = true; });
      req.on('error', () => { record.aborted = true; });
      res.on('close', () => { record.closed = true; record.complete = res.writableEnded; });
      requests.push(record);
      if (path === '/') return void res.writeHead(200, { 'content-type': 'text/plain' }).end('No root CORS');
      if (req.method === 'OPTIONS') {
        record.allowed = mode !== 'cors';
        return void res.writeHead(204, mode === 'cors' ? {} : headers).end();
      }
      const reply = (status, value) => { if (!res.destroyed) res.writeHead(status, headers).end(JSON.stringify(value)); };
      if (mode === 'dead') return reply(503, {});
      if (req.method === 'HEAD') return void res.writeHead(mode === 'no-head' ? 405 : 200, headers).end();
      if (path === '/.well-known/nostr/nip96.json') {
        if (protocol === 'nip96' && mode === 'slow') await new Promise(done => setTimeout(done, 11000));
        return reply(protocol === 'nip96' ? 200 : 404, { api_url: `${origins.nip96}/api` });
      }
      if (protocol === 'nip96' && path === '/upload') return reply(404, {});
      if (path === '/processing') {
        if (mode === 'processing-hold') return;
        if (mode === 'processing') await new Promise(done => setTimeout(done, 11000));
        const blob = blobs.get(protocol);
        return reply(201, { status: 'success', nip94_event: { tags: [['url', `${origins[protocol]}/${blob.hash}.png`], ['ox', blob.hash], ['m', 'image/png']] } });
      }
      if (req.method === 'GET') return void res.writeHead(200, { ...headers, 'content-type': 'image/png' }).end(blobs.get(protocol)?.bytes);
      if (mode === 'hang') return; // closed by AbortController; no fixture timer survives
      const chunks = [];
      try { for await (const data of req) chunks.push(data); }
      catch (error) { if (req.aborted || res.destroyed) return; throw error; }
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
      if (hold) {
        mode = await Promise.race([hold, new Promise(done => res.once('close', done))]);
        if (res.destroyed) return;
      }
      if (mode === 'refuse') return reply(403, { message: 'fixture refusal' });
      if (mode === 'paid') return reply(402, {});
      if (mode === 'malformed') return reply(201, { url: 'https://wrong.invalid/file' });
      blobs.set(protocol, { hash, bytes });
      if (mode === 'slow') await new Promise(done => setTimeout(done, 11000));
      if (mode === 'body-hang') { res.writeHead(201, headers); res.write('{'); return; }
      if (mode === 'processing' || mode === 'processing-hold') return reply(202, { status: 'processing', processing_url: `${origins.nip96}/processing` });
      reply(201, protocol === 'blossom' ? { url: `${origins[protocol]}/${hash}.png`, sha256: hash, type: 'image/png' } : { status: 'success', nip94_event: { tags: [['url', `${origins[protocol]}/${hash}.png`], ['ox', hash], ['m', 'image/png']] } });
    });
    servers.push(server);
    await new Promise((done, failed) => {
      server.once('error', failed);
      server.listen(0, '127.0.0.1', () => { server.off('error', failed); done(); });
    });
    origins[protocol] = `https://127.0.0.1:${server.address().port}`;
  }
  return {
    origins, requests, set(protocol, mode) { modes[protocol] = mode; }, close,
    hold(protocol) {
      let release;
      holds.set(protocol, new Promise(done => { release = done; }));
      return (mode = 'ok') => { holds.delete(protocol); release(mode); };
    },
  };
  } catch (error) { await close(); throw error; }
}

// Each concurrent signer scenario owns its response modes and unique ports.
export async function fakeMediaSet() {
  const groups = [];
  try {
    for (const signer of ['local', 'extension', 'remote']) groups.push([signer, await fakeMedia()]);
  } catch (error) { await Promise.all(groups.map(([, media]) => media.close())); throw error; }
  return {
    bySigner: Object.fromEntries(groups),
    origins: Object.fromEntries(groups.flatMap(([signer, media]) => Object.entries(media.origins).map(([protocol, url]) => [`${signer}-${protocol}`, url]))),
    async close() { await Promise.all(groups.map(([, media]) => media.close())); },
  };
}
