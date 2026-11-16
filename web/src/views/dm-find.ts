// A private view's people picker asks the same bounded public directory as mentions.
import type { Subscription } from '../engine/client.ts';
import { applyOps } from '../engine/ops.ts';
import type { Author, Row } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { dmError } from './dm-parts.ts';
import { dmVisible } from './dm-surface.ts';
import { faceButton, plainName } from './parts.ts';
import type { ViewEnv } from './registry.ts';

export function createDmFind(o: {
  env: ViewEnv;
  exclude(): ReadonlySet<string>;
  choose(author: Author, event?: MouseEvent): void;
  changed?(text: string): void;
  first?(): boolean;
}) {
  const { env } = o;
  const input = h('input', {
    type: 'search',
    placeholder: t('dm.find'),
    'aria-label': t('dm.find'),
    autocomplete: 'off',
  });
  const results = h('div', { class: 'dm-directory' });
  let rows: readonly Row[] = [],
    sub: Subscription | undefined,
    timer: ReturnType<typeof setTimeout> | undefined;
  let serial = 0,
    stopped = false,
    pending = false;
  let failed = '';
  const candidates = (): Author[] =>
    rows
      .filter((r) => r.kind === 'person')
      .map((r) => r.author)
      .filter((a) => !o.exclude().has(a.pubkey));
  const draw = (): void => {
    results.replaceChildren(
      ...candidates().map((author) => {
        const row = h(
          'div',
          { class: 'chan', tabindex: 0, role: 'link' },
          faceButton(author, env),
          h(
            'div',
            { class: 'pmain' },
            h('div', { class: 'name clip' }, plainName(author)),
            h('div', { class: 'muted clip' }, author.nip05 ?? ''),
          ),
        );
        row.addEventListener('click', (event) => {
          if (!(event.target as Element).closest('button')) o.choose(author, event);
        });
        row.addEventListener('auxclick', (event) => {
          if (event.button === 1 && !(event.target as Element).closest('button')) {
            event.preventDefault();
            o.choose(author, event);
          }
        });
        row.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            o.choose(author);
          }
        });
        return row;
      }),
    );
    if (failed) results.append(h('div', { class: 'fstate muted' }, dmError(failed)));
    results.hidden = !input.value.trim() || !results.childElementCount;
  };
  const open = (): void => {
    sub?.close();
    sub = undefined;
    rows = [];
    failed = '';
    draw();
    const text = input.value.trim(),
      generation = ++serial;
    pending = !!text;
    if (!text || !dmVisible(env) || stopped) return;
    const reference =
      /^(?:nostr:)?(?:npub1|nprofile1)[a-z0-9]+$/i.test(text) ||
      /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text);
    sub = env.engine.open(
      { source: 'people', account: env.engine.me(), ...(reference ? { ref: text } : { text }) },
      {
        rows(value) {
          if (generation === serial && !stopped) {
            rows = value;
            if (rows.length) pending = false;
            draw();
            o.changed?.(input.value);
          }
        },
        patch(ops) {
          if (generation === serial && !stopped) {
            rows = applyOps(rows, ops);
            if (rows.length) pending = false;
            draw();
            o.changed?.(input.value);
          }
        },
        state(value) {
          if (generation !== serial || stopped) return;
          if (value.phase === 'live' || value.phase === 'failed') pending = false;
          failed = value.phase === 'failed' ? (value.error ?? 'offline') : '';
          draw();
          o.changed?.(input.value);
        },
      },
    );
    sub.window('top', 0, 6);
    sub.visible(true);
  };
  input.addEventListener('input', () => {
    serial++;
    sub?.close();
    sub = undefined;
    rows = [];
    failed = '';
    pending = !!input.value.trim();
    draw();
    o.changed?.(input.value);
    clearTimeout(timer);
    timer = setTimeout(open, 200);
  });
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.isComposing) return;
    event.preventDefault();
    if (o.first?.()) return;
    const first = candidates()[0];
    if (first) o.choose(first);
  });
  const visibility = (): void => {
    sub?.visible(dmVisible(env));
    if (dmVisible(env) && !sub) open();
  };
  const off = env.visible.subscribe(visibility);
  document.addEventListener('visibilitychange', visibility);
  return {
    input,
    results,
    count: () => candidates().length,
    pending: () => pending || !!failed,
    refresh: draw,
    dispose(): void {
      stopped = true;
      serial++;
      clearTimeout(timer);
      sub?.close();
      off();
      document.removeEventListener('visibilitychange', visibility);
      rows = [];
      results.replaceChildren();
    },
  };
}
