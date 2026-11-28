// Bounded replay of finite avatar requests, including before dedicated-leader election.
export function createAvatarReads(send, receive) {
  const wants = new Map(); // <=256 requests, <=2048 URL bytes and 128 request bytes each.
  return {
    post(message) {
      if (message.t === 'avatar.close') {
        if (wants.delete(message.req)) send(message);
        return true;
      }
      if (message.t !== 'avatar.want') return false;
      const { req, url, rank } = message, encoder = new TextEncoder();
      if (typeof req !== 'string' || !req || encoder.encode(req).length > 128 ||
          typeof url !== 'string' || !url || encoder.encode(url).length > 2048) {
        receive({ t: 'avatar', req, result: { status: 'rejected' } });
        return true;
      }
      if (wants.has(req)) return true;
      if (wants.size >= 256) {
        receive({ t: 'avatar', req, result: { status: 'deferred', retryMs: 100 } });
        return true;
      }
      const owned = { t: 'avatar.want', req, url, ...(rank === 1 || rank === 2 ? { rank } : {}) };
      wants.set(req, owned);
      send(owned);
      return true;
    },
    receive(message) { if (message.t === 'avatar') wants.delete(message.req); },
    replay(hidden) { if (!hidden) for (const message of wants.values()) send(message); },
    close() { wants.clear(); },
  };
}
