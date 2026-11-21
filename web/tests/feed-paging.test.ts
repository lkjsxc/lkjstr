import { expect, it } from 'vitest';
import { createFeedPaging } from '../src/views/feed-paging.ts';

it.each([400, 900])('requests more with 2.5 screens left at a pane height of %i', (height) => {
  const el = document.createElement('div');
  Object.defineProperties(el, {
    clientHeight: { value: height },
    scrollHeight: { value: height * 10 },
  });
  const paging = createFeedPaging(
    el,
    () => {},
    () => {},
  );
  const rows = { first: 'head', last: 'tail', count: 60 };

  el.scrollTop = height * 6.4;
  expect(paging.next(rows, true, false, false)).toBeUndefined();
  el.scrollTop = height * 6.6;
  expect(paging.next(rows, true, false, false)).toBe('older');
  expect(paging.next(rows, true, false, false)).toBeUndefined();
  expect(paging.next({ ...rows, last: 'deeper' }, true, false, false)).toBe('older');
  expect(paging.next({ ...rows, last: 'end' }, true, true, false)).toBeUndefined();
  paging.dispose();
});
