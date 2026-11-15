// Attachments of one input, saved with the draft as soon as upload completes.
import type { Uploaded } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { failureText } from './can.ts';
import type { ViewEnv } from './registry.ts';

type Item = { name: string; el: HTMLElement; done?: Uploaded };
export function createComposeMedia(
  thumbs: HTMLElement,
  env: ViewEnv,
  state: { media?: Uploaded[] },
  save: () => void,
  ready: () => void,
) {
  let items: Item[] = []; // bound: files of the current draft
  const restoreMedia = (): void => {
    for (const done of state.media ?? []) {
      const item: Item = { name: done.url, done, el: h('div', { class: 'thumb done' }, done.url) };
      item.el.append(
        h(
          'button',
          {
            class: 'x',
            title: t('compose.drop'),
            onclick: () => {
              items = items.filter((i) => i !== item);
              item.el.remove();
              saveMedia();
              ready();
            },
          },
          '×',
        ),
      );
      items.push(item);
      thumbs.append(item.el);
    }
  };
  const saveMedia = (): void => {
    state.media = items.flatMap((i) => (i.done ? [i.done] : []));
    save();
  };

  async function upload(f: File): Promise<void> {
    const bar = h('i');
    const item: Item = {
      name: f.name,
      el: h(
        'div',
        { class: 'thumb' },
        h('span', { class: 'clip' }, f.name),
        h('span', { class: 'prog' }, bar),
      ),
    };
    const remove = h(
      'button',
      { class: 'x', title: t('compose.drop'), 'aria-label': t('compose.drop') },
      '×',
    );
    remove.addEventListener('click', () => {
      items = items.filter((i) => i !== item);
      item.el.remove();
      saveMedia();
      ready();
    });
    item.el.append(remove);
    items.push(item);
    thumbs.append(item.el);
    ready();
    const bytes = await f.arrayBuffer();
    const r = await env.engine.act(
      {
        a: 'upload',
        as: env.engine.me(),
        name: f.name,
        mime: f.type || 'application/octet-stream',
        bytes,
      },
      {
        progress: (sent, total) =>
          void (bar.style.width = `${Math.round((sent / Math.max(total, 1)) * 100)}%`),
      },
    );
    if (r.ok && r.uploaded) {
      item.done = r.uploaded;
      saveMedia();
      item.el.classList.add('done');
      if (r.uploaded.type === 'image')
        item.el.prepend(h('img', { src: r.uploaded.url, alt: f.name }));
    } else {
      item.el.classList.add('failed');
      item.el.append(h('span', { class: 'error' }, failureText(r.error)));
      items = items.filter((i) => i !== item); // it stays visible until removed, but is not part of the post
    }
    ready();
  }
  const add = (files: FileList | undefined | null): void => {
    for (const f of files ?? []) void upload(f);
  };

  restoreMedia();
  return {
    add,
    busy: () => items.some((i) => !i.done),
    count: () => items.length,
    uploaded: () => items.flatMap((i) => (i.done ? [i.done] : [])),
    clear() {
      items = [];
      state.media = [];
      thumbs.replaceChildren();
      save();
    },
    restore(uploaded: readonly Uploaded[]) {
      items = [];
      state.media = [...uploaded];
      thumbs.replaceChildren();
      restoreMedia();
      save();
    },
  };
}
