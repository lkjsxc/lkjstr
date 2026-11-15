import { afterEach, expect, it } from 'vitest';
import {
  dropViewState,
  loadViewState,
  restoreViewState,
  saveViewSlice,
  saveViewState,
  snapshotViewState,
} from '../src/shared/view-state.ts';

afterEach(() => localStorage.clear());

it('reopens a channel snapshot saved by main before independent outboxes existed', () => {
  restoreViewState('channel', {
    title: 'Room',
    __say: { text: 'unfinished', outbox: [{ as: 'a' }] },
  });
  expect(loadViewState('channel')).toEqual({ title: 'Room' });
  expect(loadViewState('channel:say')).toEqual({ text: 'unfinished', outbox: [{ as: 'a' }] });
});

it('keeps reader slices and independent outboxes together through close, reuse and reopen', () => {
  saveViewState('channel', { title: 'Room' });
  saveViewState('channel:say', { text: 'next' });
  saveViewState('channel:say:outbox', { id: 'old', drafts: [{ text: 'failed' }] });
  saveViewSlice('channel', 'reader', { unfolded: ['note'] });
  saveViewState('channel', { title: 'Renamed' });
  const closed = snapshotViewState('channel');
  dropViewState('channel');
  expect(loadViewState('channel:say:outbox')).toEqual({});
  restoreViewState('reopened', closed);
  expect(loadViewState('reopened')).toEqual({ title: 'Renamed', reader: { unfolded: ['note'] } });
  expect(loadViewState('reopened:say')).toEqual({ text: 'next' });
  expect(loadViewState('reopened:say:outbox')).toEqual({ id: 'old', drafts: [{ text: 'failed' }] });
});
