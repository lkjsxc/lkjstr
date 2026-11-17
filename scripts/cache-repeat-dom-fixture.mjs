import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { observeRepeat } from './cache-repeat-observe.mjs';
const require = createRequire(new URL('../web/package.json', import.meta.url));
const { Window } = await import(pathToFileURL(require.resolve('happy-dom')).href);
export async function domProbe({ expected, known = [{ pubkey: 'b'.repeat(64), named: false }], kind = 'home' } = {}) {
  known = known.map(person => ({ ...person, npub: person.npub ?? 'npub1' + person.pubkey }));
  const window = new Window({ url: 'http://127.0.0.1/' }), document = window.document;
  let clock = 0, sequence = 0, markCallback;
  window.PerformanceObserver = function (fn) { markCallback = fn; this.observe = () => {}; this.disconnect = () => {}; };
  const callbacks = new Map();
  Object.defineProperty(window.performance, 'timeOrigin', { value: 1000000 });
  window.performance.now = () => clock;
  window.requestAnimationFrame = fn => { const id = ++sequence; callbacks.set(id, fn); return id; };
  window.cancelAnimationFrame = id => callbacks.delete(id);
  const rect = el => {
    const top = Number(el.closest?.('[data-y]')?.dataset.y ?? 0), height = el.classList?.contains('view') ? 900 : 100;
    return { x: 0, y: top, top, left: 0, right: 1000, bottom: top + height, width: 1000, height };
  };
  window.HTMLElement.prototype.getBoundingClientRect = function () { return rect(this); };
  window.HTMLElement.prototype.getClientRects = function () { return this.hidden ? [] : [rect(this)]; };
  const make = (tag, cls, parent) => {
    const el = document.createElement(tag); el.className = cls; parent?.append(el); return el;
  };
  const view = make('div', 'view', document.body); view.dataset.kind = kind;
  const list = make('div', 'list', view);
  const add = (key, pubkey = 'b'.repeat(64), name = 'Known author', y = 0) => {
    const row = make('article', 'note', list); row.dataset.key = key; row.dataset.y = String(y);
    const face = make('span', 'av', row); face.dataset.face = pubkey;
    const head = make('div', 'nhead', row), button = make('button', 'name', head); button.textContent = name; button.title = 'npub1' + pubkey;
    return { row, face, button };
  };
  window.eval('(' + observeRepeat.toString() + ')(' + JSON.stringify({ initial: null, known }) + ')');
  window.__cacheRepeat.begin({ id: 'test', kind, expected }, 1000000);
  const advance = async ms => {
    await new Promise(done => setImmediate(done)); clock = ms;
    const batch = [...callbacks.values()]; callbacks.clear(); for (const fn of batch) fn(ms);
  };
  return { window, document, view, list, add, advance, value: () => window.__cacheRepeat.snapshot(),
    mark(detail, startTime) { markCallback({ getEntries: () => [{ name: 'lkjstr.public-cache', detail, startTime }] }); },
    close() { window.__cacheRepeat.close(); window.close(); } };
}
