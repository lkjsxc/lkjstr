// Fault injection delays only native Worker creation. It never provides engine rows or events.
export function publicCacheProbe({ delayMs = 0 } = {}) {
  const probe = {
    delayMs,
    requested: 0,
    created: [],
    ready: null,
    firstText: null,
    firstTen: null,
    firstScreen: null,
    firstKeys: [],
    shifts: [],
    visits: [],
    nextVisit: null,
  };
  globalThis.__publicCacheProbe = probe;
  const NativeShared = globalThis.SharedWorker;
  const NativeWorker = globalThis.Worker;
  // biome-ignore lint/complexity/useArrowFunction: Worker is called with new.
  globalThis.Worker = function (...args) {
    probe.created.push(performance.now());
    return Reflect.construct(NativeWorker, args);
  };
  if (NativeShared)
    // biome-ignore lint/complexity/useArrowFunction: SharedWorker is called with new.
    globalThis.SharedWorker = function (...args) {
      probe.requested++;
      const pair = new MessageChannel();
      const proxy = { port: pair.port1, onerror: null };
      const start = () => {
        probe.created.push(performance.now());
        const native = Reflect.construct(NativeShared, args);
        native.onerror = (event) => proxy.onerror?.(event);
        native.port.onmessage = (event) => {
          if (event.data?.t === 'ready' && probe.ready === null) probe.ready = performance.now();
          pair.port2.postMessage(event.data, event.ports);
        };
        pair.port2.onmessage = (event) => native.port.postMessage(event.data, event.ports);
        native.port.start();
        pair.port2.start();
      };
      if (delayMs) setTimeout(start, delayMs);
      else start();
      return proxy;
    };
  new PerformanceObserver((list) => {
    for (const item of list.getEntries())
      if (!item.hadRecentInput && probe.shifts.length < 1000)
        probe.shifts.push({ at: item.startTime, value: item.value });
  }).observe({ type: 'layout-shift', buffered: true });
  const visible = (node) =>
    node?.getClientRects().length && node.getBoundingClientRect().height > 0;
  const hydrated = (node) => {
    const name = node.querySelector('.name')?.textContent?.trim();
    const picture = node.querySelector('.av img, img.av');
    return name === 'Cache fixture' && picture?.complete && picture.naturalWidth > 0;
  };
  document.addEventListener(
    'pointerdown',
    () => {
      if (probe.nextVisit && probe.nextVisit.start === null)
        probe.nextVisit.start = performance.now();
    },
    true,
  );
  const frame = () => {
    const home = [...document.querySelectorAll('.view[data-kind="home"]')].find(visible);
    const notes = home ? [...home.querySelectorAll('.list > .note:not(.hid)')] : [];
    if (notes[0]?.querySelector('.text')?.textContent?.trim()) {
      probe.firstText ??= performance.now();
      if (!probe.firstKeys.length)
        probe.firstKeys = notes.slice(0, 10).map((node) => node.dataset.key);
      if (notes.length >= 10 && notes.slice(0, 10).every(hydrated))
        probe.firstTen ??= performance.now();
      const box = home.getBoundingClientRect();
      const screen = notes.filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.bottom > box.top && rect.top < Math.min(box.bottom, innerHeight);
      });
      if (screen.length && screen.every(hydrated)) probe.firstScreen ??= performance.now();
    }
    const visit = probe.nextVisit;
    if (visit && visit.start !== null) {
      const view = [...document.querySelectorAll(`.view[data-kind="${visit.kind}"]`)].find(visible);
      const row = view?.querySelector('[data-key]');
      if (row?.textContent?.includes('Cache fixture')) {
        probe.visits.push({
          kind: visit.kind,
          ms: performance.now() - visit.start,
          key: row.dataset.key,
          workers: probe.created.length,
        });
        probe.nextVisit = null;
      }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
