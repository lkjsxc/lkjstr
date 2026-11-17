// DOM/frame observations only; never read or write the application's event/account store.
export function observeRepeat({ initial, known = [] }) {
  const limit = 10000, people = new Map(known.map(person => [person.pubkey, person]));
  const authors = new Map(known.map(person => [person.pubkey, person])), queries = new Map(), decoded = new WeakMap();
  let current, frame, closed = false, frames = 0, dropped = 0, dirty = true, lastInspection;
  const changed = () => { dirty = true; };
  const mutations = new MutationObserver(changed);
  mutations.observe(document, { subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ['class', 'src', 'style', 'hidden', 'title', 'alt'] });
  document.addEventListener('load', changed, true); document.addEventListener('scroll', changed, true);
  globalThis.addEventListener('resize', changed);
  const epoch = () => performance.timeOrigin + performance.now();
  let cacheMarksObserved = false, marks;
  if (typeof PerformanceObserver === 'function') {
    try {
      marks = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (entry.name !== 'lkjstr.public-cache') continue;
          cacheMarksObserved = true;
          const detail = entry.detail, at = performance.timeOrigin + entry.startTime;
          if (!current || detail?.source !== current.kind || typeof detail.sub !== 'string' ||
              !Number.isInteger(detail.rows) || detail.rows < 1 || detail.rows > 6400 ||
              at < current.startedAt || queries.has(detail.sub) && queries.get(detail.sub) !== current.kind) continue;
          current.cacheMark ??= { at, source: detail.source, sub: detail.sub, rows: detail.rows };
        }
      });
      marks.observe({ type: 'mark', buffered: true });
    } catch { marks?.disconnect(); marks = undefined; }
  }
  const raw = text => !text.trim() || /^npub1[a-z0-9]+(?:…|\.{3})/i.test(text.trim()) ||
    /^[0-9a-f]{8,}(?:…|\.{3})[0-9a-f]+$/i.test(text.trim()) || /^[0-9a-f]{64}$/i.test(text.trim());
  const visible = (el, within) => {
    if (!el || !el.getClientRects().length) return false;
    const a = el.getBoundingClientRect(), b = within.getBoundingClientRect();
    return a.height > 0 && a.width > 0 && a.bottom > Math.max(0, b.top) &&
      a.top < Math.min(innerHeight, b.bottom) && a.right > b.left && a.left < b.right;
  };
  const imageReady = image => {
    if (!image?.complete || !image.naturalWidth) return false;
    const src = image.currentSrc || image.src;
    let entry = decoded.get(image);
    if (!entry || entry.src !== src) {
      entry = { src, ready: false }; decoded.set(image, entry);
      try { Promise.resolve(image.decode()).then(() => { entry.ready = true; changed(); }, changed); } catch { /* Not decoded. */ }
    }
    return entry.ready;
  };
  const nameText = node => node?.nodeType === 3 ? node.textContent : node?.matches?.('.badge') ? ''
    : node?.matches?.('img.emo') ? node.alt : [...(node?.childNodes ?? [])].map(nameText).join('');
  const author = value => {
    if (!value || !/^[0-9a-f]{64}$/.test(value.pubkey ?? '')) return;
    if (!authors.has(value.pubkey) && authors.size >= limit) { dropped++; return; }
    authors.set(value.pubkey, { npub: typeof value.npub === 'string' ? value.npub.slice(0, 100) : undefined,
      nip05: typeof value.nip05 === 'string' ? value.nip05.slice(0, 320) : undefined, picture: Boolean(value.picture) });
    changed();
  };
  const learn = rows => {
    for (const row of rows ?? []) {
      author(row.author); row.actors?.forEach(author);
      if (row.note) learn([row.note]);
      row.repostedBy?.actors?.forEach(author); author(row.replyTo?.author);
      for (const quote of row.quotes ?? []) author(quote.author);
    }
  };
  const receive = data => {
    const msg = data?.msg ?? data, source = queries.get(msg?.sub);
    if (msg?.t === 'rows') learn(msg.rows);
    if (msg?.t === 'patch') for (const op of msg.ops ?? []) learn(op.rows ?? (op.row ? [op.row] : []));
    if (!current || source !== current.kind) return;
    if (msg.t === 'rows') {
      current.firstWorkerRowsEpoch ??= epoch();
      current.workerRows = msg.rows?.length ?? 0;
    }
    if (msg.t === 'state') current.workerPhase = msg.state?.phase;
  };
  for (const Type of [globalThis.MessagePort, globalThis.Worker].filter(Boolean)) {
  const post = Type.prototype.postMessage;
  if (post) Type.prototype.postMessage = function (data, ...rest) {
    const msg = data?.msg ?? data;
    if (msg?.t === 'open') {
      if (queries.size < 128 || queries.has(msg.sub)) queries.set(msg.sub, msg.query?.source);
      else dropped++;
    }
    if (msg?.t === 'close') queries.delete(msg.sub);
    return post.call(this, data, ...rest);
  };
  }
  for (const name of ['Worker', 'SharedWorker']) {
    const Native = globalThis[name];
    if (!Native) continue;
    globalThis[name] = new Proxy(Native, { construct(target, args, next) {
      const worker = Reflect.construct(target, args, next);
      (name === 'SharedWorker' ? worker.port : worker).addEventListener('message', event => receive(event.data));
      return worker;
    } });
  }
  const inspect = () => {
    const view = [...document.querySelectorAll('.view')].find(el =>
      el.dataset.kind === current?.kind && visible(el, document.documentElement));
    if (!view) return { keys: [], authors: [], rowCount: 0, state: '', view: null };
    const rows = [...view.querySelectorAll('.list > [data-key], .rlist > [data-key]')]
      .filter(row => !row.dataset.key.startsWith('day:'));
    const keys = rows.filter(row => visible(row, view)).map(row => row.dataset.key).slice(0, 10);
    const faces = new Map();
    for (const face of view.querySelectorAll('[data-face]')) {
      if (!visible(face, view)) continue;
      const pubkey = face.dataset.face, metadata = authors.get(pubkey);
      if (!/^[0-9a-f]{64}$/.test(pubkey ?? '')) continue;
      const selector = '.quote, .note, .person, .profile, .notif';
      const group = face.closest(selector) ?? face.parentElement;
      const names = [...(group?.querySelectorAll('.name, .pname') ?? [])].filter(el => el.closest(selector) === group);
      const exact = names.find(el => metadata && el.title && [metadata.npub, metadata.nip05].includes(el.title));
      const primaryProfile = group?.matches('.profile') && face.closest('.phead')?.parentElement === group;
      const name = exact ?? (primaryProfile ? group.querySelector(':scope > .pname') : null);
      const auxiliary = Boolean(face.closest('.known')) || group?.matches('.notif') &&
        [...group.querySelectorAll('.nfaces [data-face]')].indexOf(face) >= 2;
      const image = face.querySelector('img'), before = faces.get(pubkey), ready = imageReady(image);
      const item = { pubkey, named: Boolean(name) && !raw(nameText(name)) && [...name.querySelectorAll('img.emo')].every(imageReady),
        nameKnown: Boolean(name), raw: Boolean(name) && raw(nameText(name)), identityUnresolved: !name && !auxiliary,
        image: ready, imageSeen: ready, imageExpected: Boolean(image || metadata?.picture) };
      faces.set(pubkey, before ? { ...item, nameKnown: before.nameKnown || item.nameKnown,
        named: (before.nameKnown || item.nameKnown) && (!before.nameKnown || before.named) && (!item.nameKnown || item.named),
        raw: before.raw || item.raw, identityUnresolved: before.identityUnresolved || item.identityUnresolved,
        image: before.image && item.image, imageSeen: before.imageSeen || item.imageSeen,
        imageExpected: before.imageExpected || item.imageExpected } : item);
    }
    return { keys, authors: [...faces.values()], rowCount: rows.length,
      state: view.querySelector('.fstate')?.textContent?.trim().slice(0, 200) ?? '', view };
  };
  const finishRaw = (key, at) => {
    const span = current.raw.get(key); if (!span) return;
    if (current.rawAuthorSpans.length < 256)
      current.rawAuthorSpans.push({ pubkey: key, startedMs: span.at - current.startedAt,
        durationMs: Math.max(0, at - span.at), namedBefore: span.namedBefore });
    else dropped++;
    current.raw.delete(key);
  };
  const tick = () => {
    frame = undefined;
    if (closed || !current) return;
    const now = epoch();
    if (dirty || !lastInspection) { lastInspection = inspect(); dirty = false; }
    const data = lastInspection;
    const mark = (name, yes) => {
      if (!yes) { delete current.candidates[name]; return; }
      if (current.marks[name] !== undefined) return;
      if (current.candidates[name] === undefined) current.candidates[name] = frames;
      else if (frames > current.candidates[name]) current.marks[name] = now - current.startedAt;
    };
    mark('firstContentMs', data.keys.length > 0);
    const expected = current.expected;
    const held = expected.keys?.length > 0 && expected.keys.every((key, index) => data.keys[index] === key);
    const hydrated = (expected.authors ?? []).every(old => {
      const value = data.authors.find(person => person.pubkey === old.pubkey);
      return value && !old.identityUnresolved && !value.identityUnresolved &&
        (!old.named || value.named) && (!(old.imageSeen || old.image) || value.image);
    });
    mark('cachedScreenMs', held && hydrated);
    for (const person of data.authors) {
      const previous = people.get(person.pubkey);
      if (previous && person.nameKnown && person.raw) {
        if (!current.raw.has(person.pubkey)) current.raw.set(person.pubkey, { at: now, namedBefore: previous.named });
      } else finishRaw(person.pubkey, now);
      if (people.has(person.pubkey) || people.size < limit)
        people.set(person.pubkey, { ...authors.get(person.pubkey), pubkey: person.pubkey, named: Boolean(previous?.named || person.named) });
      else dropped++;
    }
    for (const key of current.raw.keys()) if (!data.authors.some(person => person.pubkey === key)) finishRaw(key, now);
    current.last = { keys: data.keys, authors: data.authors, rowCount: data.rowCount, state: data.state };
    frames++; frame = requestAnimationFrame(tick);
  };
  const begin = (value, started = epoch()) => {
    if (current) for (const key of current.raw.keys()) finishRaw(key, epoch());
    dirty = true; lastInspection = undefined;
    current = { id: value.id, kind: value.kind, expected: value.expected ?? { keys: [], authors: [] },
      startedAt: started, marks: {}, candidates: {}, raw: new Map(), rawAuthorSpans: [] };
    if (frame === undefined) frame = requestAnimationFrame(tick);
    return { startedAt: current.startedAt };
  };
  globalThis.__cacheRepeat = {
    begin,
    snapshot() {
      if (!current) return null;
      const at = epoch(), spans = [...current.rawAuthorSpans,
        ...[...current.raw].map(([pubkey, span]) => ({ pubkey, startedMs: span.at - current.startedAt,
          durationMs: at - span.at, namedBefore: span.namedBefore }))];
      const mark = current.cacheMark;
      const painted = mark && Number.isFinite(current.marks.cachedScreenMs) &&
        mark.at <= current.startedAt + current.marks.cachedScreenMs &&
        mark.rows >= (current.expected.keys?.length ?? 0);
      return { id: current.id, kind: current.kind, startedAt: current.startedAt, endedAt: at,
        cacheMarksObserved, publicCacheMark: mark ? { ...mark, painted: Boolean(painted) } : null,
        ...current.marks, screen: current.last, firstWorkerRowsEpoch: current.firstWorkerRowsEpoch,
        workerPhase: current.workerPhase, rawAuthorSpans: spans, dropped,
        known: [...people.values()].slice(0, limit), clock: 'performance.timeOrigin + requestAnimationFrame' };
    },
    end() { const result = this.snapshot(); current = undefined; cancelAnimationFrame(frame); frame = undefined; return result; },
    close() { closed = true; current = undefined; cancelAnimationFrame(frame); frame = undefined;
      mutations.disconnect(); marks?.disconnect(); document.removeEventListener('load', changed, true);
      document.removeEventListener('scroll', changed, true); globalThis.removeEventListener('resize', changed); },
  };
  let next = initial;
  try {
    const value = sessionStorage.getItem('lkjstr-measure:cache-repeat-next');
    if (value) {
      const saved = JSON.parse(value); next = saved.visit;
      for (const person of (saved.known ?? []).slice(0, limit)) {
        people.set(person.pubkey, person); authors.set(person.pubkey, person);
      }
      sessionStorage.removeItem('lkjstr-measure:cache-repeat-next');
    }
  } catch { dropped++; }
  if (next) begin(next, performance.timeOrigin);
}
