// Measurement control budget, shared by every concurrent preflight socket.
// All received bytes count, including duplicate EVENTs; retained event IDs cap separately.
export function controlBudget({ milliseconds = 90000, bytes = 8 * 1024 * 1024,
  events = 3000, frames = 6000, frameBytes = 512 * 1024, now = Date.now } = {}) {
  const startedAt = now(), deadlineAt = startedAt + milliseconds;
  const ids = new Set(), listeners = new Set(); // <=3000 IDs and three active relay requests.
  let receivedBytes = 0, admittedBytes = 0, receivedFrames = 0, admittedFrames = 0, reason;
  const stop = value => {
    if (reason) return;
    reason = value;
    for (const listener of [...listeners]) listener();
  };
  const remaining = () => {
    const left = Math.max(0, deadlineAt - now());
    if (!left) stop('deadline');
    return reason ? 0 : left;
  };
  return { maxFrameBytes: frameBytes, stop, remaining,
    listen(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    frame(raw) {
      if (!remaining()) return false;
      const size = typeof raw === 'string' ? Buffer.byteLength(raw, 'utf8') : raw.byteLength;
      if (!Number.isFinite(size)) { stop('unsupported-frame'); return false; }
      receivedBytes += size; receivedFrames++;
      if (size > frameBytes) { stop('single-frame-byte-limit'); return false; }
      if (admittedBytes + size > bytes) { stop('aggregate-byte-limit'); return false; }
      if (admittedFrames >= frames) { stop('aggregate-frame-limit'); return false; }
      admittedBytes += size; admittedFrames++; return true;
    },
    event(id) {
      if (!remaining()) return false;
      if (ids.has(id)) return true;
      if (ids.size >= events) { stop('aggregate-event-limit'); return false; }
      ids.add(id); return true;
    },
    snapshot() { return { startedAt, deadlineAt, receivedBytes, admittedBytes, receivedFrames, admittedFrames,
      distinctEvents: ids.size, exhausted: !!reason, reason: reason ?? null,
      activeRequests: listeners.size, limits: { milliseconds, bytes, events, frames, frameBytes } }; },
  };
}
