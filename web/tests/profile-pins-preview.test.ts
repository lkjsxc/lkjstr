import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPreviewWants } from '../src/views/preview-wants.ts';

const cleanup: (() => void)[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(fn, 16));
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
});
afterEach(() => {
  for (const dispose of cleanup.splice(0).reverse()) dispose();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it('uses the feed viewport and scroll while each subscription supplies only its own preview IDs', async () => {
  const root = document.createElement('div');
  const slot = document.createElement('section');
  root.append(slot);
  document.body.append(root);
  let scroll = 0;
  let visible = true;
  root.getBoundingClientRect = () => new DOMRect(0, 0, 390, visible ? 600 : 0);
  slot.getBoundingClientRect = () => new DOMRect(0, -scroll, 390, 3000);
  const note = (id: string, y: number, parent: HTMLElement) => {
    const row = document.createElement('article');
    row.className = 'note';
    row.dataset.previews = id;
    const body = document.createElement('div');
    body.className = 'content';
    row.append(body);
    row.getBoundingClientRect = () => new DOMRect(0, y - scroll, 390, 100);
    parent.append(row);
  };
  note('pin-first', 50, slot);
  note('pin-later', 1600, slot);
  note('chronology', 800, root);
  const mainNear = vi.fn();
  const pinNear = vi.fn();
  const main = createPreviewWants(root, () => ({ id: 'profile', near: mainNear }));
  const pins = createPreviewWants(slot, () => ({ id: 'pins', near: pinNear }), root);
  cleanup.push(main.dispose, pins.dispose);
  main.sync();
  pins.sync();
  await vi.advanceTimersByTimeAsync(16);
  expect(mainNear).toHaveBeenLastCalledWith(['chronology']);
  expect(pinNear).toHaveBeenLastCalledWith(['pin-first']);

  scroll = 1200;
  root.dispatchEvent(new Event('scroll'));
  await vi.advanceTimersByTimeAsync(16);
  expect(mainNear).toHaveBeenLastCalledWith(['chronology']);
  expect(pinNear).toHaveBeenLastCalledWith(['pin-later']);

  visible = false;
  pins.sync();
  main.sync();
  await vi.advanceTimersByTimeAsync(16);
  expect(pinNear).toHaveBeenLastCalledWith([]);
  expect(mainNear).toHaveBeenLastCalledWith([]);
});
