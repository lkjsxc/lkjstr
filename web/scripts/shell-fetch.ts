// Generated service-worker transport. Integrity, not HTTP cache status, grants installation.
export const shellFetch = String.raw`
async function verified(path, signal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.throwIfAborted();
  signal?.addEventListener('abort', abort, { once: true });
  const total = setTimeout(abort, 15 * 60000);
  let idle;
  const progress = () => {
    clearTimeout(idle);
    idle = setTimeout(abort, 60000);
  };
  try {
    const immutable = /^\/[a-z-]+-[a-f0-9]{16}[.](?:js|css|wasm|json)$/.test(path);
    for (const cache of immutable ? ['force-cache', 'reload'] : ['no-store']) {
      progress();
      const response = await fetch(path, {
        cache, credentials: 'omit', redirect: 'error', signal: controller.signal,
      });
      if (!response.ok) {
        void response.body?.cancel().catch(() => {});
        if (cache === 'force-cache') continue;
        throw new Error('shell asset unavailable');
      }
      const reader = response.clone().body?.getReader();
      const chunks = [];
      let size = 0;
      if (reader) try {
        while (true) {
          const { value, done } = await reader.read();
          progress();
          if (done) break;
          chunks.push(value);
          size += value.byteLength;
        }
      } finally { reader.releaseLock(); }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
        (v) => v.toString(16).padStart(2, '0')).join('');
      controller.signal.throwIfAborted();
      if (digest === hashes.get(path)) return response;
      if (cache !== 'force-cache') throw new Error('shell asset changed');
    }
  } catch (error) {
    controller.abort();
    throw error;
  } finally {
    clearTimeout(total);
    clearTimeout(idle);
    signal?.removeEventListener('abort', abort);
  }
}
`;
