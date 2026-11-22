import WebSocket from 'ws';

const MAX_BYTES = 64 * 1024;
const TIMEOUT = 8000;

function exchange(relay, request, handle, timeout) {
  return new Promise(resolve => {
    let socket;
    let finished = false;
    let frames = 0;
    const timer = setTimeout(() => finish('timeout'), timeout);
    function finish(status) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      socket?.terminate();
      resolve(status);
    }
    try {
      socket = new WebSocket(relay, { handshakeTimeout: timeout, followRedirects: false,
        maxPayload: MAX_BYTES, maxFragments: 256, maxBufferedChunks: 1024, perMessageDeflate: false });
    } catch {
      finish('connection-error');
      return;
    }
    socket.on('error', error => {
      if (error.code === 'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH') finish('frame-too-large');
      else if (error.code === 'WS_ERR_TOO_MANY_BUFFERED_PARTS') finish('frame-budget');
      else finish('connection-error');
    });
    socket.on('close', () => finish('connection-closed'));
    socket.on('open', () => socket.send(JSON.stringify(request), error => {
      if (error) finish('send-error');
    }));
    socket.on('message', (bytes, binary) => {
      if (finished) return;
      if (++frames > 100) return finish('frame-budget');
      if (binary) return finish('invalid-frame');
      let frame;
      try {
        frame = JSON.parse(bytes);
      } catch {
        return finish('invalid-frame');
      }
      if (!Array.isArray(frame)) return finish('invalid-frame');
      const status = handle(frame);
      if (status) finish(status);
    });
  });
}

export async function readRelay(relay, filter, onEvent, timeout = TIMEOUT) {
  const sub = 'lkjstr-presence';
  let count = 0;
  const status = await exchange(relay, ['REQ', sub, filter], ([type, target, event]) => {
    if (target !== sub) return;
    if (type === 'CLOSED') return 'query-refused';
    if (type === 'EOSE') return count >= filter.limit ? 'saturated' : 'complete';
    if (type !== 'EVENT') return;
    if (++count > filter.limit) return 'saturated';
    return onEvent(event) ? 'exact-event' : undefined;
  }, timeout);
  return { relay, status, count };
}

export async function sendRelay(relay, event, timeout = TIMEOUT) {
  const status = await exchange(relay, ['EVENT', event], ([type, id, accepted]) => {
    if (type === 'OK' && id === event.id) return accepted === true ? 'accepted' : 'refused';
  }, timeout);
  return { relay, status };
}

export async function searchSupport(relay, timeout = 4000) {
  const url = new URL(relay);
  url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
  try {
    const response = await fetch(url, { headers: { accept: 'application/nostr+json' },
      redirect: 'error', signal: AbortSignal.timeout(timeout) });
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      return 'unavailable';
    }
    const chunks = [];
    let length = 0;
    for await (const chunk of response.body) {
      length += chunk.length;
      if (length > 32768) return 'unavailable';
      chunks.push(chunk);
    }
    const { supported_nips: nips } = JSON.parse(Buffer.concat(chunks));
    return Array.isArray(nips) && nips.includes(50) ? 'advertised' : 'unadvertised';
  } catch {
    return 'unavailable';
  }
}
