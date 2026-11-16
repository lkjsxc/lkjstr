// Serve an immutable copy of the exact real build on a fresh loopback port.
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, stat, mkdir, readdir } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { attachBrowser } from './real-hour-cdp.mjs';
import { delay } from './real-hour-public.mjs';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' };
export async function buildIdentity(directory) {
  const files = [];
  const walk = async (dir, prefix = '') => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) await walk(join(dir, entry.name), `${prefix}${entry.name}/`);
      else files.push({ path: `${prefix}${entry.name}`, sha256: createHash('sha256').update(await readFile(join(dir, entry.name))).digest('hex') });
    }
  };
  await walk(directory);
  if (!files.some((file) => file.path.endsWith('.wasm'))) throw Error('real:hour requires pnpm build:real, not the mock build');
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
export async function launchMeasured({ directory, runDirectory }) {
  const root = resolve(directory), sockets = new Set();
  const server = createServer(async (request, response) => {
    try {
      const path = decodeURIComponent(new URL(request.url, 'http://local').pathname);
      if (path === '/__blank') return void response.end('<!doctype html><title>measurement</title>');
      let file = resolve(root, `.${path}`);
      if (!file.startsWith(`${root}/`) && file !== root) return void response.writeHead(403).end();
      if (!(extname(path))) file = join(root, 'index.html');
      if (!(await stat(file)).isFile()) throw Error('not a file');
      response.writeHead(200, {
        'Content-Type': types[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' https: wss:; img-src 'self' https: data: blob:; media-src 'self' https: data: blob:; frame-ancestors 'none'",
      });
      response.end(await readFile(file));
    } catch { response.writeHead(404).end(); }
  });
  server.on('connection', (socket) => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${server.address().port}`;
  const profile = join(runDirectory, 'profile');
  await mkdir(profile, { recursive: true });
  let context, cdp;
  try {
    context = await chromium.launchPersistentContext(profile, {
      executablePath: process.env.LKJSTR_CHROME ?? `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`,
      headless: true, serviceWorkers: 'block', viewport: { width: 1440, height: 900 }, locale: 'en-US', colorScheme: 'dark',
      args: ['--no-sandbox', '--disable-background-networking', '--remote-debugging-port=0'],
    });
    let endpoint;
    for (let attempt = 0; attempt < 50 && !endpoint; attempt++) {
      const text = await readFile(join(profile, 'DevToolsActivePort'), 'utf8').catch(() => '');
      const [port, path] = text.trim().split('\n');
      if (path) endpoint = `ws://127.0.0.1:${port}${path}`; else await delay(100);
    }
    if (!endpoint) throw Error('Chromium CDP endpoint unavailable');
    const wasmModule = (await readdir(root)).find((name) => /^engine-wasm-.*\.js$/.test(name));
    cdp = await attachBrowser(endpoint, { wasmModule: wasmModule ? `/${wasmModule}` : undefined });
    await delay(150);
    return { context, cdp, base, async close() {
      let closeTimer;
      await Promise.race([context.close().catch(() => {}), new Promise((done) => {
        closeTimer = setTimeout(async () => { await cdp.send('Browser.close', {}, undefined, 2000).catch(() => {}); done(); }, 5000);
      })]);
      clearTimeout(closeTimer);
      await cdp.close();
      for (const socket of sockets) socket.destroy();
      await new Promise((done) => server.close(done));
    } };
  } catch (error) {
    await context?.close().catch(() => {}); await cdp?.close();
    for (const socket of sockets) socket.destroy();
    await new Promise((done) => server.close(done));
    throw error;
  }
}
