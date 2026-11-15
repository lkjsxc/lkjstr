// Persist completed attachments while failed files keep their retry controls in memory.
import type { Uploaded } from '../engine/protocol.ts';
import { createAttachments } from './compose-media.ts';
import type { ViewEnv } from './registry.ts';

export function createComposeMedia(
  thumbs: HTMLElement,
  env: ViewEnv,
  state: { media?: Uploaded[] },
  save: () => void,
  ready: () => void,
) {
  let restoring = true;
  const media = createAttachments(
    env,
    () => {
      if (restoring) return;
      state.media = media.media();
      save();
      ready();
    },
    thumbs,
  );
  media.restore(state.media ?? []);
  restoring = false;
  return {
    add: (files: FileList | undefined | null) => media.add(files ?? []),
    busy: media.blocked,
    count: media.count,
    uploaded: media.media,
    clear() {
      media.clear();
      state.media = [];
      save();
    },
    restore: (uploaded: readonly Uploaded[]) => media.restore(uploaded),
    dispose: media.dispose,
  };
}
