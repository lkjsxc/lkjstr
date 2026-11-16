// Only 100 private rows are mounted. Off-screen heights and fold/selection state remain local to this view.
import type { Author, DmMessage } from '../engine/protocol.ts';
import { dayOf } from '../shared/format.ts';
import { h } from '../shared/h.ts';
import { renderDmMessage } from './dm-message-row.ts';
import type { ViewEnv } from './registry.ts';

export function createDmWindow(o: {
  el: HTMLElement;
  list: HTMLElement;
  env: ViewEnv;
  reply(message: DmMessage): void;
  hold(): () => void;
  moved(): void;
}) {
  let rows: readonly DmMessage[] = [],
    people: ReadonlyMap<string, Author> = new Map(),
    start = 0,
    selected = '',
    stopped = false;
  const heights = new Map<string, number>(),
    folded = new Set<string>(); // <=8000 retained message ids
  const nodes = new Map<string, { el: HTMLElement; signature: string }>(); // <=100 mounted rows
  const top = h('div', { class: 'dm-space', 'aria-hidden': 'true' }),
    bottom = h('div', { class: 'dm-space', 'aria-hidden': 'true' });
  const height = (i: number): number => heights.get(rows[i]?.id ?? '') ?? 112;
  const sum = (from: number, to: number): number => {
    let value = 0;
    for (let i = from; i < to; i++) value += height(i);
    return value;
  };
  let frame = 0;
  const measure = (): void => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (stopped) return;
      const restore = o.hold();
      for (const [key, node] of nodes) heights.set(key, node.el.getBoundingClientRect().height);
      top.style.height = `${sum(0, start)}px`;
      bottom.style.height = `${sum(start + nodes.size, rows.length)}px`;
      restore();
      o.moved();
    });
  };
  const render = (): void => {
    const restore = o.hold(),
      wanted = new Set<string>(),
      children: HTMLElement[] = [top];
    start = Math.max(0, Math.min(start, rows.length - 100));
    for (let i = start; i < Math.min(rows.length, start + 100); i++) {
      const message = rows[i];
      if (!message) continue;
      const previous = rows[i - 1],
        below = rows[i + 1];
      const grouped =
        !!previous &&
        previous.author === message.author &&
        previous.at - message.at <= 300_000 &&
        dayOf(previous.at) === dayOf(message.at);
      const day = dayOf(message.at),
        divider = !previous ? day !== dayOf(Date.now()) : day !== dayOf(previous.at);
      const signature = JSON.stringify([
        message,
        grouped,
        divider,
        below?.subject,
        people.get(message.author),
        message.reply && people.get(message.reply.author),
      ]);
      let node = nodes.get(message.id);
      if (!node || node.signature !== signature) {
        const row = renderDmMessage({
          message,
          below,
          grouped,
          people,
          env: o.env,
          reply: o.reply,
          known: (id) => rows.find((m) => m.id === id),
          folded,
          jump: (id) => nodes.get(id)?.el.scrollIntoView({ block: 'nearest' }),
        });
        const el = h(
          'div',
          { class: 'dm-row', 'data-key': message.id },
          divider ? h('div', { class: 'day' }, day) : null,
          row,
        );
        el.addEventListener('click', () => select(message.id));
        node = { el, signature };
        nodes.set(message.id, node);
      }
      node.el.classList.toggle('sel', message.id === selected);
      wanted.add(message.id);
      children.push(node.el);
    }
    children.push(bottom);
    for (const key of nodes.keys()) if (!wanted.has(key)) nodes.delete(key);
    top.style.height = `${sum(0, start)}px`;
    bottom.style.height = `${sum(start + nodes.size, rows.length)}px`;
    let cursor = o.list.firstChild;
    for (const child of children) {
      if (cursor === child) cursor = cursor.nextSibling;
      else o.list.insertBefore(child, cursor);
    }
    while (cursor) {
      const next = cursor.nextSibling;
      cursor.remove();
      cursor = next;
    }
    restore();
    measure();
  };
  function select(key: string): void {
    selected = key;
    for (const [id, node] of nodes) node.el.classList.toggle('sel', id === key);
  }
  return {
    draw(next: readonly DmMessage[], authors: ReadonlyMap<string, Author>): void {
      const anchor = rows[start]?.id;
      rows = next;
      people = authors;
      if (anchor && start) {
        const at = rows.findIndex((m) => m.id === anchor);
        if (at >= 0) start = at;
      }
      const live = new Set(rows.map((m) => m.id));
      for (const key of heights.keys()) if (!live.has(key)) heights.delete(key);
      for (const key of folded) if (!live.has(key)) folded.delete(key);
      render();
    },
    node: (id: string) => nodes.get(id)?.el,
    selected: () => rows.find((m) => m.id === selected),
    show(id: string): boolean {
      const at = rows.findIndex((m) => m.id === id);
      if (at < 0) return false;
      if (!nodes.has(id)) {
        start = Math.max(0, at - 20);
        render();
      }
      select(id);
      return true;
    },
    move(direction: number): void {
      const at = rows.findIndex((m) => m.id === selected),
        message = rows[Math.max(0, Math.min(rows.length - 1, at + direction))];
      if (!message) return;
      const index = rows.indexOf(message);
      if (!nodes.has(message.id)) {
        start = Math.max(0, index - 20);
        render();
      }
      select(message.id);
      nodes.get(message.id)?.el.scrollIntoView({ block: 'nearest' });
    },
    scroll(): void {
      const offset = o.el.getBoundingClientRect().top - o.list.getBoundingClientRect().top;
      let at = 0,
        px = 0;
      while (at < rows.length && px + height(at) < offset) {
        px += height(at);
        at++;
      }
      if ((at < start + 8 && start > 0) || (at >= start + 80 && start + 100 < rows.length)) {
        start = Math.max(0, at - 20);
        render();
      }
    },
    clear(): void {
      for (const node of nodes.values()) node.signature = '';
      render();
    },
    dispose(): void {
      stopped = true;
      cancelAnimationFrame(frame);
      nodes.clear();
      heights.clear();
      folded.clear();
      rows = [];
      people = new Map();
      o.list.replaceChildren();
    },
  };
}
