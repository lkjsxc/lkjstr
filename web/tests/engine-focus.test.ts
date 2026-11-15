import { expect, it } from 'vitest';
import { createEngine } from '../src/engine/client.ts';
import type { ToEngine } from '../src/engine/protocol.ts';
import { h } from '../src/shared/h.ts';

it('sends the keyboard tile subscription and clears it on hiding or closing', async () => {
  const messages: ToEngine[] = [];
  const engine = createEngine({ post: (m) => messages.push(m), listen() {}, close() {} });
  const owner = h('div', { class: 'view' });
  const pane = h('div', { class: 'pane cur' }, owner);
  document.body.append(pane);
  const sub = engine.open({ source: 'global' }, { rows() {}, patch() {} }, owner);
  const last = () => messages.filter((m) => m.t === 'hint').at(-1)?.hint;
  try {
    sub.visible(true);
    await Promise.resolve();
    expect(last()?.focusedSub).toBe(sub.id);
    sub.visible(false);
    await Promise.resolve();
    expect(last()?.focusedSub).toBeUndefined();
    sub.visible(true);
    await Promise.resolve();
    sub.close();
    await Promise.resolve();
    expect(last()?.focusedSub).toBeUndefined();
    expect(last()?.visibleSubs).toEqual([]);
  } finally {
    pane.remove();
    engine.dispose();
  }
});
