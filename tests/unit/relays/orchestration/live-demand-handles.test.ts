import { describe, expect, it, vi } from 'vitest';
import { createLiveDemandHandles } from '../../../../src/lib/relays/orchestration/live-demand-handles';

describe('live demand handles', () => {
  it('replaces one channel without releasing others', () => {
    const handles = createLiveDemandHandles();
    const notesA = vi.fn();
    const notesB = vi.fn();
    const meta = vi.fn();

    handles.replace('notes', notesA);
    handles.replace('meta', meta);
    handles.replace('notes', notesB);

    expect(notesA).toHaveBeenCalledOnce();
    expect(meta).not.toHaveBeenCalled();
    expect(handles.has('notes')).toBe(true);
    expect(handles.has('meta')).toBe(true);

    handles.releaseAll();
    expect(notesB).toHaveBeenCalledOnce();
    expect(meta).toHaveBeenCalledOnce();
  });
});
