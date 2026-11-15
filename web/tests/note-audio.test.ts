import { afterEach, expect, it, vi } from 'vitest';
import { noteRow } from '../src/engine/mock/rows.ts';
import { createWorld } from '../src/engine/mock/world.ts';
import { readNoteState } from '../src/shared/note-state.ts';
import { createSettings } from '../src/shared/settings.ts';
import { createSignal } from '../src/shared/signal.ts';
import { kv } from '../src/shared/storage.ts';
import { createRowList } from '../src/views/feed-draw.ts';
import type { ViewEnv } from '../src/views/registry.ts';

afterEach(() => {
  localStorage.clear();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
it('keeps native audio through metadata/settings redraws, then restores seek and device preferences', () => {
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  const world = createWorld(Date.now());
  if (!world.notes[0]) throw new Error('fixture');
  const row = {
    ...noteRow(world, world.notes[0], { me: '' }),
    media: [{ type: 'audio' as const, url: 'https://example.test/sound.mp3' }],
  };
  const env = {
    instance: 'audio-state',
    settings: createSettings(),
    engine: { accounts: createSignal({ accounts: [] }) },
  } as unknown as ViewEnv;
  const list = document.createElement('div');
  document.body.append(list);
  const rows = createRowList(list, env, false);
  rows.draw([row]);
  const audio = list.querySelector('audio');
  if (!audio) throw new Error('audio');
  Object.defineProperties(audio, { readyState: { value: 1 }, duration: { value: 120 } });
  audio.currentTime = 48;
  audio.volume = 0.4;
  audio.muted = true;
  audio.playbackRate = 1.5;
  audio.dispatchEvent(new Event('seeked'));
  audio.dispatchEvent(new Event('volumechange'));
  expect(readNoteState(env.instance, row.id).audio?.['0']).toBe(48);
  const patched = {
    ...row,
    previews: [
      {
        source: 'https://example.test/story',
        url: 'https://example.test/story',
        title: 'Late title',
        kind: 'page' as const,
      },
    ],
  };
  rows.draw([patched]);
  expect(list.querySelector('audio')).toBe(audio);
  rows.clear();
  rows.draw([patched]);
  expect(list.querySelector('audio')).toBe(audio);
  rows.draw([]);
  rows.draw([row]);
  const restored = list.querySelector('audio');
  if (!restored) throw new Error('restored audio');
  Object.defineProperties(restored, { readyState: { value: 1 }, duration: { value: 120 } });
  restored.dispatchEvent(new Event('loadedmetadata'));
  expect(restored).not.toBe(audio);
  expect(restored.currentTime).toBe(48);
  expect(restored.volume).toBe(0.4);
  expect(restored.muted).toBe(true);
  expect(restored.playbackRate).toBe(1.5);
  expect(kv.get('volume')).toMatchObject({ volume: 0.4, muted: true, rate: 1.5 });
  rows.dispose();
});
