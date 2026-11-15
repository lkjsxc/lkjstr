import { beforeEach, describe, expect, it } from 'vitest';
import { NOTE_STATE_LIMIT, readNoteState, writeNoteState } from '../src/shared/note-state.ts';
import { kv } from '../src/shared/storage.ts';
import {
  dropViewState,
  loadViewState,
  restoreViewState,
  saveViewState,
  snapshotViewState,
} from '../src/shared/view-state.ts';

beforeEach(() => {
  for (const key of kv.keys()) kv.remove(key);
});
describe('reader choices', () => {
  it('survives older reading-position saves and travels with a reopened tab', () => {
    const old = loadViewState<{ pos: number }>('one');
    writeNoteState('one', 'note', {
      shown: true,
      warning: true,
      unfolded: true,
      media: ['picture'],
      quotes: ['quote'],
      replies: 120,
      chips: true,
    });
    saveViewState('one', { ...old, pos: 8 });
    expect(readNoteState('one', 'note').unfolded).toBe(true);
    expect(readNoteState('two', 'note')).toEqual({});
    saveViewState('one:say', { text: 'unfinished channel message' });
    const closed = snapshotViewState('one');
    dropViewState('one');
    restoreViewState('reopened', closed);
    expect(loadViewState<{ text: string }>('reopened:say').text).toBe('unfinished channel message');
    expect(readNoteState('reopened', 'note')).toEqual({
      shown: true,
      warning: true,
      unfolded: true,
      media: ['picture'],
      quotes: ['quote'],
      replies: 120,
      chips: true,
    });
  });
  it('drops the oldest changed note at the documented bound', () => {
    for (let n = 0; n <= NOTE_STATE_LIMIT; n++)
      writeNoteState('one', String(n), { unfolded: true });
    expect(readNoteState('one', '0')).toEqual({});
    expect(readNoteState('one', String(NOTE_STATE_LIMIT)).unfolded).toBe(true);
  });
});
