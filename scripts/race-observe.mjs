// Navigation-relative DOM witnesses at animation frames, with a second frame before a paint mark.
export function observeOpen({ site }) {
  if (globalThis.__openRace) return;
  const state = globalThis.__openRace = { site, timeOrigin: performance.timeOrigin, marks: {},
    totalLayoutShift: 0, cls: 0, layoutShifts: 0, longTasks: 0, longTaskMs: 0, maxLongTaskMs: 0,
    postRestShifts: 0, frames: 0, maxFrameGapMs: 0, samples: [], rawKeyOver100Ms: 0 };
  let sessionStart = 0, sessionEnd = 0, sessionScore = 0;
  try { new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.hadRecentInput) continue;
      state.totalLayoutShift += entry.value; state.layoutShifts++;
      if (state.marks.restMs !== undefined) state.postRestShifts++;
      if (entry.startTime - sessionEnd > 1000 || entry.startTime - sessionStart > 5000) {
        sessionStart = entry.startTime; sessionScore = 0;
      }
      sessionEnd = entry.startTime; sessionScore += entry.value; state.cls = Math.max(state.cls, sessionScore);
      state.lastLayoutShiftMs = entry.startTime;
    }
  }).observe({ type: 'layout-shift', buffered: true }); } catch { state.layoutShiftUnsupported = true; }
  try { new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      state.longTasks++; state.longTaskMs += entry.duration;
      state.maxLongTaskMs = Math.max(state.maxLongTaskMs, entry.duration);
    }
  }).observe({ type: 'longtask', buffered: true }); } catch { state.longTaskUnsupported = true; }
  try { new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) if (entry.name === 'first-contentful-paint') state.marks.fcpMs = entry.startTime;
  }).observe({ type: 'paint', buffered: true }); } catch { /* DOM marks remain available. */ }
  const avatarFailures = new Map(); // At most 200 failed public avatar rows.
  addEventListener('error', event => {
    const img = event.target;
    if (img?.tagName !== 'IMG' || !img.closest('.av, .picture')) return;
    const row = img.closest(site === 'lkjstr' ? '.note[data-note]' : 'section.card > div[id]');
    const id = row?.dataset.note ?? row?.id;
    if (id && avatarFailures.size < 200) avatarFailures.set(id, { ms: performance.now(), url: img.currentSrc || img.src });
  }, true);
  const decoded = new WeakMap();
  const rawNames = new Map(); // Only the first 100 rendered authors per navigation.
  const candidates = new Map();
  const mark = (name, ready, now) => {
    if (state.marks[name] !== undefined) return;
    if (!ready) { candidates.delete(name); return; }
    if (candidates.has(name)) state.marks[name] = now;
    else candidates.set(name, now);
  };
  let lastAt = 0, stableFrom = 0, previousGeometry = '', lastSample = 0;
  const frame = now => {
    state.frames++; if (lastAt) state.maxFrameGapMs = Math.max(state.maxFrameGapMs, now - lastAt); lastAt = now;
    const root = site === 'lkjstr' ? document.querySelector('.view[data-kind="home"]') : document.querySelector('main .timeline');
    let rows = root ? [...root.querySelectorAll(site === 'lkjstr' ? '.note[data-note]' : 'section.card > div[id]')]
      .filter(row => site !== 'lkjstr' || row.closest('.view') === root) : [];
    rows = rows.filter(row => !row.parentElement?.closest(site === 'lkjstr' ? '.note[data-note]' : 'section.card > div[id]')).slice(0, 100);
    const bound = root?.getBoundingClientRect();
    const bottom = Math.min(innerHeight, bound?.bottom ?? innerHeight), top = Math.max(0, bound?.top ?? 0);
    const details = rows.map(row => {
      const rect = row.getBoundingClientRect();
      const text = row.querySelector(site === 'lkjstr' ? '.content .text' : '.note .content');
      const name = row.querySelector(site === 'lkjstr' ? '.nhead .name' : '.user .display_name');
      const picture = row.querySelector(site === 'lkjstr' ? '.av img' : '.picture img');
      const label = ((name?.textContent ?? '') + [...(name?.querySelectorAll('img[alt]') ?? [])].map(img => img.alt).join('')).trim();
      const named = Boolean(label && !/^@?(?:npub1|[0-9a-f]{12})/.test(label));
      const source = picture?.currentSrc ?? '';
      if (picture?.complete && picture.naturalWidth > 0 && decoded.get(picture)?.src !== source) {
        const entry = { src: source, ready: false }; decoded.set(picture, entry);
        void picture.decode().then(() => { entry.ready = true; }).catch(() => {});
      }
      const image = Boolean(picture?.complete && picture.naturalWidth > 0 && decoded.get(picture)?.ready && !source.includes('robohash.org'));
      const rendered = rect.width > 0 && rect.height > 0 && getComputedStyle(row).visibility !== 'hidden';
      const textVisible = Boolean(text?.textContent?.trim() && rendered);
      const visible = rendered && rect.bottom > top && rect.top < bottom && rect.right > 0 && rect.left < innerWidth;
      const id = row.dataset.note ?? row.id;
      const fallback = image ? 'picture' : !named ? 'unresolved-name' : avatarFailures.has(id) ? 'image-failed'
        : site === 'nostter' && source.includes('robohash.org') && decoded.get(picture)?.ready ? 'chosen-placeholder'
        : site === 'lkjstr' && !picture && row.querySelector('.av .faceletter') ? 'no-picture-or-failed' : 'unresolved-picture';
      const settled = named && !fallback.startsWith('unresolved');
      if (visible && !named && !rawNames.has(id) && rawNames.size < 100) rawNames.set(id, { at: now, counted: false });
      const raw = rawNames.get(id);
      if (raw && !raw.counted && !named && now - raw.at > 100) { raw.counted = true; state.rawKeyOver100Ms++; }
      return { id, text: textVisible, rendered, visible, named, image, settled, fallback,
        author: row.querySelector('[data-face]')?.getAttribute('data-face') ?? row.querySelector('.picture a')?.getAttribute('href') ?? null,
        picture: source || picture?.src || null, imageComplete: picture?.complete ?? false,
        imageWidth: picture?.naturalWidth ?? 0, top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width };
    });
    const visible = details.filter(row => row.visible), ten = details.slice(0, 10);
    const filled = visible.length > 0 && (details.at(-1)?.bottom ?? 0) >= bottom - 2;
    mark('firstNoteMs', visible.some(row => row.text), now);
    mark('tenRenderedMs', ten.length === 10 && ten.every(row => row.rendered && row.named && row.image), now);
    mark('tenInViewportMs', visible.length >= 10 && visible.slice(0, 10).every(row => row.named && row.image), now);
    mark('firstScreenMs', filled && visible.every(row => row.named && row.image), now);
    mark('firstScreenSettledMs', filled && visible.every(row => row.settled), now);
    mark('tenSettledMs', ten.length === 10 && ten.every(row => row.rendered && row.settled), now);
    const geometry = visible.map(row => [row.id, Math.round(row.top * 2), Math.round(row.bottom * 2),
      Math.round(row.left * 2), Math.round(row.width * 2)].join(':')).join('|');
    if (geometry !== previousGeometry) { stableFrom = now; previousGeometry = geometry; state.lastGeometryChangeMs = now; }
    if (visible.length && filled && now - Math.max(stableFrom, state.lastLayoutShiftMs ?? 0) >= 2000) {
      state.marks.restMs ??= now; state.finalRestMs = Math.max(stableFrom, state.lastLayoutShiftMs ?? 0) + 2000;
    } else delete state.finalRestMs;
    if (now - lastSample >= 1000 && state.samples.length < 180) {
      lastSample = now;
      state.samples.push({ ms: now, rows: details.length, visible: visible.length, hydrated: visible.filter(row => row.named && row.image).length, filled });
    }
    state.avatarFailures = [...avatarFailures].map(([id, failure]) => ({ id, ...failure }));
    state.firstTen = ten; state.firstScreen = visible.slice(0, 20);
    state.rows = details.length; state.visibleRows = visible.length; state.viewportFilled = filled;
    if (!state.stop) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
