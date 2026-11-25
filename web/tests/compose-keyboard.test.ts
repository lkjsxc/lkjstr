// After a post the on-screen keyboard is not opened again on a touch screen; a key or a fine pointer keeps the caret.
import { afterEach, expect, it, vi } from 'vitest';
import type { ActResult } from '../src/engine/client.ts';
import type { Action } from '../src/engine/protocol.ts';
import { afterSend } from '../src/shared/platform.ts';
import { mountCompose } from '../src/views/compose.ts';
import { setup } from './wishes-support.ts';

const pointer = (coarse: boolean): void =>
  void vi.stubGlobal('matchMedia', (q: string) => ({
    matches: coarse && q.includes('coarse'),
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }));

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  document.body.replaceChildren();
});

function composer() {
  const x = setup();
  x.engine.act = vi.fn(
    (_: Action) => new Promise<ActResult>(() => undefined), // signing never ends in this test
  ) as typeof x.engine.act;
  document.body.append(x.el);
  mountCompose(x.el, x.env);
  const field = x.el.querySelector('textarea') as HTMLTextAreaElement;
  field.focus();
  field.value = 'hello';
  field.dispatchEvent(new Event('input'));
  return { ...x, field, post: x.el.querySelector('.primary') as HTMLButtonElement };
}

it('puts the keyboard away after Post is tapped on a touch screen', () => {
  pointer(true);
  const c = composer();
  c.post.click();
  expect(c.field.value).toBe('');
  expect(document.activeElement).not.toBe(c.field);
});

it('keeps the caret in the field after a press with a mouse', () => {
  pointer(false);
  const c = composer();
  c.post.click();
  expect(c.field.value).toBe('');
  expect(document.activeElement).toBe(c.field);
});

it('blurs only when the press came from a touch screen', () => {
  const field = document.createElement('textarea');
  document.body.append(field);
  pointer(true);
  field.focus();
  afterSend(field, false);
  expect(document.activeElement).not.toBe(field);
  afterSend(field, true);
  expect(document.activeElement).toBe(field);
});
