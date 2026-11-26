import { expect, it } from 'vitest';
import { nearPlace } from '../src/views/time-near.ts';

const rows = ['a', 'b', 'c', 'd', 'e'].map((key) => ({ key }));
const at = (known: string[]) => (key: string) => (known.includes(key) ? key : undefined);

it('uses the row itself, else the nearest counted row, older first', () => {
  expect(nearPlace(rows, 'c', at(['c', 'b', 'd']))).toBe('c');
  expect(nearPlace(rows, 'c', at(['b', 'd']))).toBe('d');
  expect(nearPlace(rows, 'c', at(['a']))).toBe('a');
  // Rows loaded below the counted ones (older history) stand at the oldest counted row.
  expect(nearPlace(rows, 'e', at(['a', 'b']))).toBe('b');
});

it('says nothing without a counted row or a known key', () => {
  expect(nearPlace(rows, 'c', at([]))).toBeUndefined();
  expect(nearPlace(rows, 'z', at(['a']))).toBeUndefined();
  expect(nearPlace(rows, undefined, at(['a']))).toBeUndefined();
});
