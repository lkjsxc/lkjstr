// Optional owned TCP forwarding for the two public lkjstr origins; TLS and response bytes stay end-to-end.
import net from 'node:net';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const exec = promisify(execFile);
const hosts = ['lkjsxc.com', 'lkjstr.lkjsxc.com'];
export const routeProbeUrl = 'https://lkjsxc.com/kjkvgy4anzctrhjllpwxzc3m4q/file';
const delay = ms => new Promise(done => setTimeout(done, ms));
const checkedPort = port => {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid owned route port');
  return port;
};
export const resolverRules = port => hosts.map(host => 'MAP ' + host + ' 127.0.0.1:' + checkedPort(port)).join(', ');
export const sshArguments = port => ['-N', '-T', '-S', 'none', '-o', 'ControlMaster=no', '-o', 'ControlPersist=no',
  '-o', 'BatchMode=yes', '-o', 'ExitOnForwardFailure=yes', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=2',
  '-L', '127.0.0.1:' + checkedPort(port) + ':10.203.47.10:443', 'root@archserver'];
export function validateProbe(metadata, contentType) {
  if (metadata.http_code !== 200 || Number(metadata.ssl_verify_result) !== 0 ||
      !metadata.url_effective?.startsWith('https://') || metadata.num_redirects !== 0 ||
      (contentType && metadata.content_type?.split(';')[0] !== contentType))
    throw Error('Public origin route probe did not return the expected valid-TLS response');
}
const listening = port => new Promise(done => {
  const socket = net.connect({ host: '127.0.0.1', port });
  const finish = answer => { socket.destroy(); done(answer); };
  socket.once('connect', () => finish(true)); socket.once('error', () => finish(false));
  socket.setTimeout(500, () => finish(false));
});
const freePort = () => new Promise((done, reject) => {
  const server = net.createServer(); server.once('error', reject);
  server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(error => error ? reject(error) : done(port)); });
});
export async function probePublic(url, destination, route, contentType) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw Error('Public HTTPS probe required');
  const args = ['--silent', '--show-error', '--noproxy', '*', '--proto', '=https', '--max-time', '15',
    '--connect-timeout', '5', '--output', destination, '--write-out', '%{json}'];
  if (route && hosts.includes(parsed.hostname)) args.push('--connect-to', parsed.hostname + ':443:127.0.0.1:' + route.port);
  args.push(url);
  const { stdout } = await exec('curl', args, { timeout: 18000, maxBuffer: 65536 });
  const metadata = JSON.parse(stdout); validateProbe(metadata, contentType);
  const body = await readFile(destination);
  return { url, status: metadata.http_code, contentType: metadata.content_type, tlsVerified: true,
    bytes: body.length, sha256: createHash('sha256').update(body).digest('hex'),
    totalMs: metadata.time_total * 1000, remoteIp: metadata.remote_ip, remotePort: metadata.remote_port };
}
export async function startEdgeRoute(directory) {
  const port = await freePort();
  // Multiplexing must be disabled: a shared master could leave a forward after this owned child exits.
  const child = spawn('ssh', sshArguments(port), { stdio: ['ignore', 'ignore', 'ignore'] });
  let exit, spawnError;
  const ended = new Promise(done => {
    child.once('error', error => { spawnError = error; exit = { error: error.code }; done(); });
    child.once('exit', (code, signal) => { exit = { code, signal }; done(); });
  });
  const evidence = { kind: 'archserver-edge-tcp', started: new Date().toISOString(), port,
    sshHost: 'root@archserver', destination: '10.203.47.10:443', mappedHosts: hosts,
    resolverRules: resolverRules(port), multiplexing: false,
    note: 'Same mapping for both clients. Original URL, Host, TLS SNI/certificate and body preserved; no host files or services changed.' };
  let closed = false;
  const close = async () => {
    if (closed) return; closed = true;
    if (!exit) child.kill('SIGTERM');
    await Promise.race([ended, delay(2000)]);
    if (!exit) { child.kill('SIGKILL'); await ended; }
    evidence.closed = new Date().toISOString(); evidence.exit = exit;
    evidence.listenerClosed = !await listening(port);
    if (!evidence.listenerClosed) throw Error('Owned route port is still listening after SSH cleanup');
  };
  try {
    const deadline = Date.now() + 10000;
    while (!exit && !await listening(port) && Date.now() < deadline) await delay(50);
    if (exit || !await listening(port)) throw Error('Owned SSH route did not open' + (spawnError ? ': ' + spawnError.code : ''));
    evidence.probe = await probePublic(routeProbeUrl, directory + '/route-avatar.bin', { port }, 'image/png');
    return { port, evidence, resolverRules: resolverRules(port), close };
  } catch (error) { await close(); throw error; }
}
export async function verifyLiveIndex(base, expectedHash, directory, route) {
  const path = directory + '/live-index.html';
  try {
    const evidence = await probePublic(base + '/', path, route, 'text/html');
    if (evidence.sha256 !== expectedHash) throw Error('Live index differs from supplied release; stop rather than measure an unknown build');
    return evidence;
  } finally { await rm(path, { force: true }); }
}
