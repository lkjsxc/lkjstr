// Private test plaintext stays in the owned browser. Only readiness and timing leave it.
export function installPrivateCacheProbe() {
  let current, frame;
  const present = (kind, marker) => [...document.querySelectorAll(
    '.view[data-kind="' + kind + '"] ' + (kind === 'message' ? '.dm-row' : '.chan'))]
    .some(row => {
      const view = row.closest('.view');
      if (!view || !row.getClientRects().length || !view.getClientRects().length || !row.textContent.includes(marker)) return false;
      const a = row.getBoundingClientRect(), b = view.getBoundingClientRect();
      return a.width > 0 && a.height > 0 && a.bottom > Math.max(0, b.top) &&
        a.top < Math.min(innerHeight, b.bottom) && a.right > Math.max(0, b.left) &&
        a.left < Math.min(innerWidth, b.right);
    });
  globalThis.__privateCacheProbe = {
    begin(kind, marker, startedAt = performance.timeOrigin + performance.now()) {
      cancelAnimationFrame(frame);
      current = { kind, marker, startedAt, candidate: false };
      const tick = () => {
        const yes = present(kind, marker);
        if (yes && current.candidate) {
          current.paintedMs = performance.timeOrigin + performance.now() - current.startedAt;
          return;
        }
        current.candidate = yes; frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick); return startedAt;
    },
    result() {
      if (!current) return null;
      return { kind: current.kind, paintedMs: current.paintedMs,
        startedAt: current.startedAt, bodyPresent: present(current.kind, current.marker) };
    },
    clear() { cancelAnimationFrame(frame); current = undefined; },
  };
}
export async function waitPrivatePaint(page, limit = 10000) {
  try { await page.waitForFunction(() => Number.isFinite(globalThis.__privateCacheProbe.result()?.paintedMs), null, { timeout: limit }); }
  catch { /* Missing stored content is evidence, not invented fixture success. */ }
  return page.evaluate(() => globalThis.__privateCacheProbe.result());
}
