// Serves ../dist the way the production host does: the same Content-Security-Policy, the page for every path
// without a dot, 404 for a missing file. node scripts/serve.ts [--port=8417]
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { toneUrl } from '../src/engine/mock/fixtures-media.ts';

const dist = join(new URL('..', import.meta.url).pathname, '..', 'dist');
const port = Number(process.argv.find((a) => a.startsWith('--port='))?.slice(7) ?? 8417);
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};
// A test-only loopback allowlist; the release CSP still permits chosen public relays.
const testRelay = process.argv.find((a) => a.startsWith('--test-relay='))?.slice(13);
if (testRelay && !/^ws:\/\/127\.0\.0\.1:\d+$/.test(testRelay))
  throw new Error('loopback relay required');
const testMedia =
  process.argv
    .find((a) => a.startsWith('--test-media='))
    ?.slice(13)
    .split(',') ?? [];
if (testMedia.some((url) => !/^https:\/\/127\.0\.0\.1:\d+$/.test(url)))
  throw new Error('loopback media required');
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  testRelay
    ? `connect-src 'self' ${testRelay} ${testMedia.join(' ')}`
    : "connect-src 'self' https: wss:",
  "img-src 'self' https: data: blob:",
  "media-src 'self' https: data: blob:",
  "frame-ancestors 'none'",
].join('; ');

const testPreviews = process.argv.includes('--test-previews');
let healthProbes = 0;
let previewRequests = 0;
const server = createServer((req, res) => {
  if (testPreviews) {
    const u = new URL(req.url ?? '/', 'http://local');
    const json = (value: unknown): void => {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(value));
    };
    if (u.pathname === '/__test_audio.wav') {
      const bytes = Buffer.from(toneUrl().split(',')[1] ?? '', 'base64');
      const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range ?? '');
      const start = range ? Number(range[1]) : 0;
      const end = range?.[2] ? Math.min(Number(range[2]), bytes.length - 1) : bytes.length - 1;
      if (start > end) return void res.writeHead(416).end();
      return void res
        .writeHead(range ? 206 : 200, {
          'Content-Type': 'audio/wav',
          'Accept-Ranges': 'bytes',
          'Content-Length': end - start + 1,
          ...(range ? { 'Content-Range': `bytes ${start}-${end}/${bytes.length}` } : {}),
        })
        .end(bytes.subarray(start, end + 1));
    }
    if (u.pathname === '/preview/health') {
      healthProbes++;
      return json({ ok: true, version: 1 });
    }
    if (u.pathname === '/__test_preview_counts') return json({ healthProbes, previewRequests });
    if (u.pathname === '/preview') {
      previewRequests++;
      const url = u.searchParams.get('url') ?? '';
      return json({
        url,
        siteName: 'Local fixture news',
        title: 'A public page from a local fixture',
        description: 'This is metadata, without an embed.',
        imageUrl: `http://${req.headers.host}/icon-192.png`,
        kind: 'page',
      });
    }
  }
  const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname));
  let file = join(dist, path);
  if (!file.startsWith(dist)) return void res.writeHead(400).end();
  if (!existsSync(file) || statSync(file).isDirectory()) {
    if (path.slice(1).includes('.')) return void res.writeHead(404).end('not found');
    file = join(dist, 'index.html');
  }
  const hashedName = /[.-][0-9a-f]{16,64}(?:_bg)?\.[^/]+$/.test(file);
  res.writeHead(200, {
    'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': hashedName ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  res.end(readFileSync(file));
}).listen(port, '127.0.0.1', () =>
  console.log(`http://127.0.0.1:${(server.address() as { port: number }).port}`),
);
