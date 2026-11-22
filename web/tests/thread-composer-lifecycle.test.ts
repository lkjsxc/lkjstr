import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { NoteRow, SubState } from '../src/engine/protocol.ts';
import { mountThread } from '../src/views/thread.ts';
import { note } from './public-snapshots-support.ts';
import { setup } from './wishes-support.ts';

type OwnedComposer = {
  host: HTMLElement;
  field: HTMLTextAreaElement;
  upload: AbortController;
  disposals: number;
};
const ownership = vi.hoisted(() => ({ mounts: [] as OwnedComposer[] }));

// The real thread owns this composer boundary, including its in-flight upload resource.
vi.mock('../src/views/compose.ts', () => ({
  mountCompose(host: HTMLElement) {
    const field = document.createElement('textarea');
    const owned = { host, field, upload: new AbortController(), disposals: 0 };
    ownership.mounts.push(owned);
    host.append(field);
    return () => {
      owned.disposals++;
      owned.upload.abort();
    };
  },
}));

beforeEach(() => {
  vi.useFakeTimers();
  ownership.mounts.length = 0;
  localStorage.clear();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  document.body.replaceChildren();
  localStorage.clear();
});

function fixture() {
  const x = setup();
  const thread = mountThread({
    el: x.el,
    env: x.env,
    state: {},
    save() {},
    redraw() {},
  });
  const focus: NoteRow = { ...note(), thread: { role: 'focus', depth: 0 } };
  const draw = (rows: NoteRow[], phase: SubState['phase'] = 'live') => {
    const planned = thread.plan(rows, {
      phase,
      relaysAsked: 1,
      relaysAnswered: phase === 'cache' ? 0 : 1,
    });
    x.el.replaceChildren(
      ...planned.flatMap((part) => (part.kind === 'thread-part' ? [thread.part(part)] : [])),
    );
    return planned;
  };
  return { ...x, thread, focus, draw };
}

it('preserves the mounted editor and upload while an ordinary thread temporarily has no focus', () => {
  const x = fixture();
  try {
    x.draw([x.focus]);
    expect(ownership.mounts).toHaveLength(1);
    const owned = ownership.mounts[0]!;
    owned.field.value = 'Unfinished reply';
    expect(owned.field.isConnected).toBe(true);
    expect(owned.upload.signal.aborted).toBe(false);

    x.draw([], 'cache');
    expect(owned.disposals).toBe(0);
    expect(owned.upload.signal.aborted).toBe(false);
    expect(owned.field.value).toBe('Unfinished reply');

    x.draw([x.focus]);
    expect(ownership.mounts).toHaveLength(1);
    expect(x.el.querySelector('textarea')).toBe(owned.field);
    expect(owned.field.value).toBe('Unfinished reply');
    expect(owned.upload.signal.aborted).toBe(false);
  } finally {
    x.thread.dispose();
  }
  expect(ownership.mounts[0]?.disposals).toBe(1);
  expect(ownership.mounts[0]?.upload.signal.aborted).toBe(true);
});

it('disposes the editor and upload when an ordinary focus becomes a non-note focus', () => {
  const x = fixture();
  try {
    x.draw([x.focus]);
    const owned = ownership.mounts[0]!;
    const generic = { ...x.focus, eventKind: 30311 };
    const planned = x.draw([generic]);
    expect(planned.some((part) => part.kind === 'thread-part' && part.part === 'say')).toBe(false);
    expect(owned.disposals).toBe(1);
    expect(owned.upload.signal.aborted).toBe(true);
    expect(owned.host.childElementCount).toBe(0);

    x.draw([generic]);
    expect(owned.disposals).toBe(1);
    x.draw([x.focus]);
    expect(ownership.mounts).toHaveLength(2);
    expect(ownership.mounts[1]?.upload.signal.aborted).toBe(false);
    expect(x.el.querySelector('textarea')).toBe(ownership.mounts[1]?.field);
  } finally {
    x.thread.dispose();
  }
  expect(ownership.mounts.map((owned) => owned.disposals)).toEqual([1, 1]);
});

it('never mounts a reply editor for a covered kind-30311 focus', () => {
  const x = fixture();
  try {
    const covered = {
      ...x.focus,
      eventKind: 30311,
      hidden: { reason: 'muted-person', revealable: true },
      segments: [],
    };
    const planned = x.draw([covered]);
    expect(planned.some((part) => part.kind === 'thread-part' && part.part === 'say')).toBe(false);
    expect(ownership.mounts).toHaveLength(0);
    expect(x.el.querySelector('textarea')).toBeNull();
  } finally {
    x.thread.dispose();
  }
});
