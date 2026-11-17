// Production lkjstr response policy observed in bootstrap-infra at 33ea5fa, 2026-11-16.
// This loopback fallback has HTTP/1.1 and no WAN/TLS leg; reports must retain that distinction.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { gzipSync } from 'node:zlib';
export const productionPolicy = {
  observed: '2026-11-16T23:31:36Z', source: 'bootstrap-infra 33ea5fa public_app_edge/nginx.conf.j2',
  csp: "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' wss: https:; img-src 'self' https: data: blob:; media-src 'self' https: data: blob:; font-src 'self' https: data:; worker-src 'self' blob:; manifest-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'",
  compression: 'gzip, level 1, minimum 256 bytes; no Brotli/HTTP3 claimed',
};
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.wasm': 'application/wasm',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.txt': 'text/plain', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif' };
const compressedTypes = new Set(['text/html', 'text/css', 'application/javascript', 'application/wasm', 'application/json',
  'application/manifest+json', 'image/svg+xml']);
export async function startStatic(directory, port = 0) {
  const root = resolve(directory), sockets = new Set();
  const security = { 'Content-Security-Policy': productionPolicy.csp, 'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'Strict-Transport-Security': 'max-age=31536000' };
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://local').pathname);
      if (/(^|\/)\./.test(pathname) || !['GET', 'HEAD'].includes(request.method)) {
        response.writeHead(404, security).end(); return;
      }
      let file = resolve(root, '.' + pathname);
      if (!file.startsWith(root + '/') && file !== root) throw Error('Outside build');
      let info = await stat(file).catch(() => null);
      if (!info?.isFile()) {
        if (pathname.slice(1).includes('.')) { response.writeHead(404, security).end(); return; }
        file = resolve(root, 'index.html'); info = await stat(file);
      }
      let bytes = await readFile(file);
      const type = types[extname(file)] ?? 'application/octet-stream';
      const hashed = /[.-][0-9a-f]{16,64}(?:_bg)?\.[^/]+$/.test(file);
      const index = file === resolve(root, 'index.html');
      const headers = { ...security, 'Content-Type': type, 'Last-Modified': info.mtime.toUTCString(),
        'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache' };
      const compressible = bytes.length >= 256 && compressedTypes.has(type);
      const gzip = compressible && /(?:^|[,\s])gzip(?:[,;\s]|$)/.test(request.headers['accept-encoding'] ?? '');
      if (compressible) headers.Vary = 'Accept-Encoding';
      if (!index) {
        const tag = '"' + Math.floor(info.mtimeMs / 1000).toString(16) + '-' + bytes.length.toString(16) + '"';
        headers.ETag = (gzip ? 'W/' : '') + tag;
        const matched = request.headers['if-none-match']?.split(',').some(value =>
          value.trim() === '*' || value.trim().replace(/^W\//, '') === tag);
        if (matched ||
            (!request.headers['if-none-match'] && request.headers['if-modified-since'] &&
            Date.parse(request.headers['if-modified-since']) >= Math.floor(info.mtimeMs / 1000) * 1000)) {
          response.writeHead(304, headers).end(); return;
        }
      }
      if (gzip) { bytes = gzipSync(bytes, { level: 1 }); headers['Content-Encoding'] = 'gzip'; }
      response.writeHead(200, headers); response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch { response.writeHead(404, security).end(); }
  });
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  await new Promise((done, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', done); });
  return { base: 'http://127.0.0.1:' + server.address().port, policy: productionPolicy,
    async close() { for (const socket of sockets) socket.destroy(); await new Promise(done => server.close(done)); } };
}
