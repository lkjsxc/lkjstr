// A thread tab's own parts (docs/interface-thread.md), around the list feed.ts draws: what the reader opened (kept
// with the tab), the reply field under the focus (its draft is the tab's, under `:say`, so it comes back with the
// tab), how long a note above is still looked for, and replies pressed on its notes.
import type { NoteRow, Row, SubState } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { mountCompose } from './compose.ts';
import { plainName } from './parts.ts';
import type { ViewEnv } from './registry.ts';
import { threadPart } from './thread-parts.ts';
import { type Drawn, planThread, type ThreadPart, type ThreadUi } from './thread-plan.ts';

/** After the relays first answered, how long a note above is still looked for before it is said to be missing. */
const GRACE_MS = 4000;

export type ThreadState = { thread?: ThreadUi; reply?: boolean };

export function mountThread(o: {
  readonly el: HTMLElement;
  readonly env: ViewEnv;
  readonly state: ThreadState;
  readonly save: () => void;
  readonly redraw: () => void;
}) {
  const { env, state } = o;
  const say = h('div', { class: 'tsay', 'data-pass': '' });
  say.addEventListener('focusin', () => say.classList.add('used'), { once: true });
  let closeSay: (() => void) | undefined;
  let focus: NoteRow | undefined;
  let answered = 0; // when the relays first answered
  const since = new Map<string, number>(); // bound: the notes above one focus
  let timer: ReturnType<typeof setTimeout> | undefined;
  const ui = (): ThreadUi => state.thread ?? {};
  const change = (next: ThreadUi): void => {
    state.thread = next;
    o.save();
    o.redraw();
  };
  const field = (): HTMLTextAreaElement | null => say.querySelector('textarea');
  const toField = (): void => {
    const area = field();
    area?.focus({ preventScroll: true });
    area?.scrollIntoView({ block: 'nearest' });
  };
  /** Opened by a reply pressed elsewhere: the field takes the keyboard once the tab is in front and drawn. */
  const wanted = (): void => {
    if (!state.reply || !env.visible.get() || !field()?.isConnected) return;
    state.reply = undefined;
    o.save();
    toField();
  };
  const offVisible = env.visible.subscribe((on) => void (on && requestAnimationFrame(wanted)));
  const opened = (e: Event): void => {
    const id = (e as CustomEvent<string>).detail;
    if (!ui().open?.includes(id)) change({ ...ui(), open: [...(ui().open ?? []), id] });
  };
  o.el.addEventListener('thread-open', opened);
  const reply = (row: NoteRow): boolean => {
    if (row.id === focus?.id) toField();
    else env.open('thread', { id: row.id, title: plainName(row.author), reply: true });
    return true;
  };
  const press = (p: ThreadPart): void => {
    if (p.part === 'earlier') change({ ...ui(), earlier: true });
    if (p.part === 'more') change({ ...ui(), branches: [...(ui().branches ?? []), p.head] });
  };
  return {
    /** The env the rows are drawn with: a reply pressed in the thread comes here. */
    env: { ...env, reply } satisfies ViewEnv,
    part: (p: ThreadPart): HTMLElement => threadPart(p, { say, press }),
    plan(rows: readonly Row[], s: SubState | undefined): Drawn[] {
      const now = Date.now();
      if (s && s.phase !== 'cache') answered ||= now;
      let soonest = Number.POSITIVE_INFINITY;
      const wait = (id: string): 'loading' | 'missing' => {
        if (!since.has(id)) since.set(id, now);
        if (!answered) return 'loading';
        const left = Math.max(answered, since.get(id) ?? now) + GRACE_MS - now;
        if (left <= 0) return 'missing';
        soonest = Math.min(soonest, left);
        return 'loading';
      };
      const drawn = planThread(rows, ui(), { asking: !answered, wait });
      clearTimeout(timer);
      if (soonest < Number.POSITIVE_INFINITY) timer = setTimeout(o.redraw, soonest + 50);
      focus = rows.find((r): r is NoteRow => r.kind === 'note' && r.thread?.role === 'focus');
      if (focus) {
        const name = plainName(focus.author);
        closeSay ??= mountCompose(say, { ...env, instance: `${env.instance}:say` }, undefined, {
          id: focus.id,
          name,
        });
        const area = field();
        if (area) area.placeholder = t('thread.replyHint', { name });
        if (state.reply) requestAnimationFrame(wanted);
      }
      return drawn;
    },
    dispose(): void {
      clearTimeout(timer);
      o.el.removeEventListener('thread-open', opened);
      offVisible();
      closeSay?.();
    },
  };
}
