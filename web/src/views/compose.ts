// The composer: a tab like any other. The draft is saved as it is typed and survives a reload. Pictures arrive by
// paste, drop or the button and show their progress. Below it, the result of the latest post only.
import type { Delivery, Emoji, Uploaded } from '../engine/protocol.ts';
import { h, replaceChildren } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';
import { icon } from '../shared/icons.ts';
import { keyLabel } from '../shared/platform.ts';
import { loadViewState, saveViewState } from '../shared/view-state.ts';
import { openEmojiPicker } from './emoji-picker.ts';
import { avatar, displayName } from './parts.ts';
import type { ViewEnv } from './registry.ts';

type Ref = { name: string; text: string };
type State = {
  text?: string;
  replyTo?: string;
  replyOf?: Ref;
  quote?: string;
  quoteOf?: Ref;
  title?: string;
  /** Custom emoji put into the text with the picker. */
  emoji?: Emoji[];
};
type Item = { name: string; el: HTMLElement; done?: Uploaded };

export function mountCompose(el: HTMLElement, env: ViewEnv): () => void {
  const state: State = loadViewState<State>(env.instance);
  const save = (): void => saveViewState(env.instance, state);
  let items: Item[] = []; // bound: the files of one draft
  let sending = false;

  const area = h('textarea', {
    class: 'ctext',
    rows: 4,
    placeholder: t(state.replyTo ? 'compose.replyHint' : 'compose.hint'),
    'aria-label': t('view.compose'),
  });
  area.value = state.text ?? '';
  const who = h('div', { class: 'cwho' });
  const thumbs = h('div', { class: 'thumbs' });
  const result = h('div', { class: 'cresult', role: 'status' });
  const file = h('input', {
    type: 'file',
    multiple: true,
    accept: 'image/*,video/*,audio/*',
    hidden: true,
  });
  const attach = h(
    'button',
    {
      class: 'icon',
      title: t('compose.attach'),
      'aria-label': t('compose.attach'),
      onclick: () => file.click(),
    },
    icon('image'),
  );
  /** Puts text where the caret is and leaves the caret after it, as typing would. */
  const insert = (text: string): void => {
    const at = area.selectionStart ?? area.value.length;
    area.setRangeText(text, at, area.selectionEnd ?? at, 'end');
    area.focus({ preventScroll: true });
    area.dispatchEvent(new Event('input'));
  };
  const emoji: HTMLElement = h(
    'button',
    { class: 'icon', title: t('compose.emoji'), 'aria-label': t('compose.emoji') },
    icon('smile'),
  );
  emoji.addEventListener('click', () =>
    openEmojiPicker(env, emoji, (p) => {
      if (p.url) {
        const code = p.emoji.slice(1, -1);
        state.emoji = [...(state.emoji ?? []).filter((e) => e.code !== code), { code, url: p.url }];
      }
      insert(p.emoji);
    }),
  );
  const post = h(
    'button',
    { class: 'btn primary', title: keyLabel('Mod+Enter') },
    t(state.replyTo ? 'compose.reply' : 'compose.post'),
  );
  const context = (label: Key, ref: Ref | undefined, clear: () => void): HTMLElement | null =>
    ref
      ? h(
          'div',
          { class: 'cctx' },
          h('span', { class: 'muted clip' }, t(label, { name: ref.name }), ' ', ref.text),
          h(
            'button',
            {
              class: 'x',
              title: t('compose.drop'),
              'aria-label': t('compose.drop'),
              onclick: clear,
            },
            '×',
          ),
        )
      : null;
  const head = h('div');
  const drawHead = (): void =>
    replaceChildren(
      head,
      context(
        'compose.replyingTo',
        state.replyOf,
        () => ((state.replyTo = state.replyOf = undefined), save(), drawHead()),
      ),
      context(
        'compose.quoting',
        state.quoteOf,
        () => ((state.quote = state.quoteOf = undefined), save(), drawHead()),
      ),
    );

  const ready = (): void => {
    const signedIn = Boolean(env.engine.me());
    const busy = items.some((i) => !i.done);
    post.disabled =
      sending || busy || !signedIn || (!area.value.trim() && !items.length && !state.quote);
  };
  const drawWho = (): void => {
    const a = env.engine.accounts.get();
    const me = a.accounts.find((x) => x.author.pubkey === a.active);
    replaceChildren(
      who,
      me
        ? [avatar(me.author, 'av sm'), h('span', { class: 'clip' }, displayName(me.author))]
        : h('span', { class: 'muted' }, t('error.signed-out')),
    );
    ready();
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
      item.el.classList.add('done');
      if (r.uploaded.type === 'image')
        item.el.prepend(h('img', { src: r.uploaded.url, alt: f.name }));
    } else {
      item.el.classList.add('failed');
      item.el.append(
        h(
          'span',
          { class: 'error' },
          `${t(`error.${r.error?.code ?? 'internal'}` as Key)}${r.error?.message ? `: ${r.error.message}` : ''}`,
        ),
      );
      items = items.filter((i) => i !== item); // it stays visible until removed, but is not part of the post
    }
    ready();
  }
  const add = (files: FileList | undefined | null): void => {
    for (const f of files ?? []) void upload(f);
  };

  const showDelivery = (relays: readonly Delivery[], final: boolean): void => {
    const ok = relays.filter((r) => r.state === 'ok').length;
    const failed = relays.filter((r) => r.state === 'failed' || r.state === 'timeout');
    replaceChildren(
      result,
      h(
        'div',
        { class: final && !ok ? 'error' : '' },
        t(final ? 'compose.delivered' : 'compose.sending', { ok, all: relays.length }),
      ),
      failed.map((r) =>
        h('div', { class: 'muted' }, `${r.url.replace(/^wss:\/\//, '')}: ${r.message ?? r.state}`),
      ),
    );
  };
  async function send(): Promise<void> {
    ready();
    if (post.disabled) return;
    sending = true;
    ready();
    const media = items.flatMap((i) => (i.done ? [i.done] : []));
    const r = await env.engine.act(
      {
        a: 'publish',
        as: env.engine.me(),
        what: {
          k: 'note',
          draft: {
            text: area.value,
            replyTo: state.replyTo,
            quote: state.quote,
            media,
            emoji: (state.emoji ?? []).filter((e) => area.value.includes(`:${e.code}:`)),
          },
        },
      },
      { delivery: (relays) => showDelivery(relays, false) },
    );
    sending = false;
    if (r.ok) {
      showDelivery(r.delivery ?? [], true);
      area.value = '';
      state.text = '';
      state.replyTo = state.replyOf = state.quote = state.quoteOf = state.emoji = undefined;
      save();
      items = [];
      thumbs.replaceChildren();
      drawHead();
    } else
      replaceChildren(
        result,
        h(
          'div',
          { class: 'error' },
          `${t(`error.${r.error?.code ?? 'internal'}` as Key)}${r.error?.message ? `: ${r.error.message}` : ''}`,
        ),
      );
    ready();
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  area.addEventListener('input', () => {
    ready();
    clearTimeout(timer);
    timer = setTimeout(() => ((state.text = area.value), save()), 300);
  });
  area.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.isComposing)
      e.preventDefault(), void send();
  });
  area.addEventListener('paste', (e) => {
    if (e.clipboardData?.files.length) e.preventDefault(), add(e.clipboardData.files);
  });
  el.addEventListener('dragover', (e) => (e.preventDefault(), el.classList.add('drop-on')));
  el.addEventListener('dragleave', () => el.classList.remove('drop-on'));
  el.addEventListener(
    'drop',
    (e) => (e.preventDefault(), el.classList.remove('drop-on'), add(e.dataTransfer?.files)),
  );
  file.addEventListener('change', () => (add(file.files), (file.value = '')));
  post.addEventListener('click', () => void send());

  el.classList.add('compose');
  el.replaceChildren(
    head,
    area,
    thumbs,
    h('div', { class: 'cbar' }, who, emoji, attach, file, post),
    result,
  );
  drawHead();
  drawWho();
  const off = env.engine.accounts.subscribe(drawWho);
  if (state.replyTo || state.quote) requestAnimationFrame(() => area.focus());
  return () => {
    clearTimeout(timer);
    state.text = area.value;
    save();
    off();
  };
}
