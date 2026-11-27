import { createEngine } from '../src/engine/client.ts';
import type { FromEngine, NoteRow, Row } from '../src/engine/protocol.ts';
import { h } from '../src/shared/h.ts';
import { setLang } from '../src/shared/i18n.ts';
import { createSettings } from '../src/shared/settings.ts';
import { createSignal } from '../src/shared/signal.ts';
import { saveViewState } from '../src/shared/view-state.ts';
import { mountFeed } from '../src/views/feed.ts';

const author = { pubkey: 'a'.repeat(64), npub: 'npub1fixture', name: 'Fixture' };
const time = Date.UTC(2026, 10, 27, 12);
const nextFrame = () => new Promise<void>((done) => requestAnimationFrame(() => done()));
const note = (index: number): NoteRow => {
  const id = index.toString(16).padStart(64, '0');
  return {
    kind: 'note',
    key: id,
    id,
    bech32: `note1${id.slice(0, 58)}`,
    author,
    at: time - index * 1000,
    segments: [{ k: 'text', text: `Row ${index}. Text wraps when the pane narrows. `.repeat(5) }],
    media: [],
    quotes: [],
    reactions: [],
    counts: { replies: 0, reposts: 0, reactions: 0, zaps: 0, partial: false },
    mine: { own: false, reposted: false, bookmarked: false },
  };
};
const row = (kind: string, index: number): Row => {
  const n = note(index);
  return kind === 'notifications'
    ? {
        kind: 'notification',
        key: `notice-${index}`,
        type: 'reply',
        note: n,
        at: n.at,
        actors: [author],
        others: 0,
        unread: true,
      }
    : n;
};

async function exercise(kind: string, phone: boolean) {
  localStorage.clear();
  setLang('en');
  const view = h('div', { class: 'view', 'data-kind': kind });
  const body = h('div', { class: 'body own' }, view);
  const pane = h('div', { class: 'pane cur' }, body);
  pane.style.cssText = 'width: 100vw; height: 75vh';
  const layer = h('div');
  document.body.replaceChildren(pane, layer);
  saveViewState('feed-overlap', { pubkey: author.pubkey, tag: 'fixture', text: 'fixture' });
  const settings = createSettings();
  let receive!: (message: FromEngine) => void;
  let sub = '';
  const engine = createEngine({
    post(message) {
      if (message.t === 'open' && message.query.source === kind) sub = message.sub;
    },
    listen(handler) {
      receive = handler;
    },
    close() {},
  });
  receive({ t: 'ready', version: 15, engine: 'fixture' });
  receive({
    t: 'accounts',
    accounts: [{ author, signer: 'local', unread: 0 }],
    active: author.pubkey,
  });
  const dispose = mountFeed(
    view,
    {
      instance: 'feed-overlap',
      engine,
      settings,
      visible: createSignal(true),
      layer,
      open() {},
      close() {},
      setTitle() {},
      menu() {},
      resetLayouts() {},
    },
    kind,
  );
  const original = Array.from({ length: 28 }, (_, n) => row(kind, n + 10));
  const head = original[0]!;
  const profile: Row = {
    kind: 'profile',
    key: 'profile-header',
    author,
    about: [],
    relays: [],
    partial: false,
    followed: false,
    followsYou: false,
    self: false,
    muted: false,
  };
  const rows = kind === 'profile' ? [profile, ...original] : original;
  const anchor = rows[0]!;
  const cases: ReturnType<typeof measure>[] = [];
  const scroll = (top: number) => {
    view.scrollTop = top;
    view.dispatchEvent(new Event('scroll'));
  };
  function measure(phase: string) {
    const viewport = view.getBoundingClientRect();
    const bars = Array.from(view.querySelectorAll('.fbar, .rbar, .profile'), (node) =>
      node.getBoundingClientRect(),
    );
    const fresh = view.querySelector('.fresh:not([hidden])')?.getBoundingClientRect();
    const rail = view.querySelector('.time-rail:not([hidden])')?.getBoundingClientRect();
    const anchorTop = view.querySelector(`[data-key="${anchor.key}"]`)?.getBoundingClientRect().top;
    let overlap = 0;
    for (const note of view.querySelectorAll('.list > :is(.note, .notif)')) {
      const box = note.getBoundingClientRect();
      for (const bar of bars)
        if (Math.min(box.right, bar.right) > Math.max(box.left, bar.left))
          overlap = Math.max(
            overlap,
            Math.min(viewport.bottom, bar.bottom, box.bottom) -
              Math.max(viewport.top, bar.top, box.top),
          );
    }
    return {
      phase,
      scroll: view.scrollTop,
      anchorTop,
      overlap,
      viewTop: viewport.top,
      barBottom: Math.max(...bars.map((bar) => bar.bottom)),
      freshTop: fresh?.top,
      railTop: rail?.top,
    };
  }
  const sample = (phase: string) => void cases.push(measure(phase));
  try {
    if (!sub) throw new Error(`The ${kind} feed did not open a subscription`);
    receive({ t: 'rows', sub, rows, atTop: true, atBottom: true });
    await nextFrame();
    sample('head');
    scroll(view.scrollHeight - view.clientHeight);
    await nextFrame();
    sample('bottom');
    // WebKit has no swipe API on Linux. Reproduce the touch lifecycle and sampled native scroll offsets.
    if (phone) view.dispatchEvent(new Event('touchstart'));
    scroll(view.scrollTop / 2);
    await nextFrame();
    scroll(180);
    if (phone) view.dispatchEvent(new Event('touchend'));
    await nextFrame();
    scroll(68);
    sample('before prepend');
    receive({ t: 'patch', sub, ops: [{ op: 'insert', before: head.key, rows: [row(kind, 9)] }] });
    receive({ t: 'fresh', sub, count: 1 });
    sample('after prepend');
    await nextFrame();
    pane.style.width = '78vw';
    await nextFrame();
    scroll(24);
    sample('near top after resize');
    await nextFrame();
    scroll(0);
    sample('scroll limit');
    await nextFrame();
    await new Promise((done) => setTimeout(done, 360));
    sample('at rest');
    scroll(view.scrollTop + 32);
    sample('before window trim');
    receive({ t: 'rows', sub, rows, atTop: false, atBottom: true });
    receive({ t: 'fresh', sub, count: 1 });
    sample('after window trim');
    return cases;
  } finally {
    dispose();
    engine.dispose();
    settings.dispose();
  }
}

Object.assign(window, { exercise });
