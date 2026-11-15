// The composer saves typed drafts and retains failed channel messages for retry.
import type { Delivery, Draft, Emoji, Failure, Mention, Uploaded } from '../engine/protocol.ts';
import { h, replaceChildren } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';
import { icon } from '../shared/icons.ts';
import { keyCaps, pressed } from '../shared/keys.ts';
import { kv } from '../shared/storage.ts';
import { loadViewState, saveViewState } from '../shared/view-state.ts';
import { openMenu } from '../wm/menus.ts';
import { ability, failureText } from './can.ts';
import { createComposeMedia } from './compose-media.ts';
import { createMentions } from './compose-mentions.ts';
import { type ChannelDraft, createChannelOutbox } from './compose-outbox.ts';
import { createWho } from './compose-who.ts';
import { openEmojiPicker } from './emoji-picker.ts';
import type { ViewEnv } from './registry.ts';

type Ref = { name: string; text: string };
type State = {
  text?: string;
  outbox?: ChannelDraft[];
  replyTo?: string;
  replyOf?: Ref;
  quote?: string;
  quoteOf?: Ref;
  title?: string;
  /** Custom emoji put into the text with the picker. */
  emoji?: Emoji[];
  media?: Uploaded[];
  mentions?: Mention[];
};

/** `channel`: the composer of a channel tab; what it sends is a message in that channel. */
export function mountCompose(el: HTMLElement, env: ViewEnv, channel?: string): () => void {
  const state: State = loadViewState<State>(env.instance);
  const save = (): void => saveViewState(env.instance, state);

  const area = h('textarea', {
    class: 'ctext',
    rows: channel ? 2 : 4,
    placeholder: t(state.replyTo ? 'compose.replyHint' : channel ? 'channel.say' : 'compose.hint'),
    'aria-label': t('view.compose'),
  });
  area.value = state.text ?? '';
  const mentions = createMentions(area, env, state, () => {
    state.text = area.value;
    save();
  });
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
    { class: 'btn primary', title: keyCaps('send')[0] },
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
    const can = ability(env.engine);
    const busy = media.busy();
    post.hidden = can === 'signed-out';
    post.title = can === 'read-only' ? t('error.read-only') : (keyCaps('send')[0] ?? '');
    attach.disabled = can !== 'ok';
    post.disabled =
      !!outbox?.full() ||
      busy ||
      can !== 'ok' ||
      (!area.value.trim() && !media.count() && !state.quote);
  };

  const restore = (draft: Draft): boolean => {
    if (media.busy()) {
      result.textContent = t('compose.uploadWait');
      return false;
    }
    if (area.value || media.count()) {
      openMenu(env.layer, post, [
        {
          label: t('compose.editWhenEmpty'),
          run: () => {
            if (
              !outbox.retain({
                text: area.value,
                media: media.uploaded(),
                mentions: state.mentions,
                replyTo: state.replyTo,
                quote: state.quote,
                channel,
                emoji: state.emoji,
              })
            ) {
              result.textContent = t('compose.saveFailed');
              return;
            }
            area.value = '';
            media.clear();
            if (restore(draft)) outbox.removeDraft(draft);
          },
        },
      ]);
      return false;
    }
    const next = {
      ...state,
      text: draft.text,
      replyTo: draft.replyTo,
      quote: draft.quote,
      emoji: [...(draft.emoji ?? [])],
      mentions: [...(draft.mentions ?? [])],
      media: [...(draft.media ?? [])],
    };
    if (!kv.persist(`view:${env.instance}`, next)) {
      result.textContent = t('compose.saveFailed');
      return false;
    }
    Object.assign(state, next);
    area.value = draft.text;
    mentions.reset();
    media.restore(draft.media ?? []);
    save();
    drawHead();
    ready();
    area.focus({ preventScroll: true });
    return true;
  };
  const outbox = createChannelOutbox(env, state.outbox ?? [], ready, showDelivery, restore);
  state.outbox = undefined;
  const media = createComposeMedia(thumbs, env, state, save, ready);

  function showDelivery(relays: readonly Delivery[], final: boolean, error?: Failure): void {
    if (error) return replaceChildren(result, h('div', { class: 'error' }, failureText(error)));
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
  }
  async function send(): Promise<void> {
    ready();
    if (post.disabled) return;
    const text = area.value;
    const draft: Draft = {
      text,
      mentions: state.mentions,
      channel,
      replyTo: state.replyTo,
      quote: state.quote,
      media: media.uploaded(),
      emoji: (state.emoji ?? []).filter((e) => text.includes(`:${e.code}:`)),
    };
    const clear = (): void => {
      area.value = state.text = '';
      state.mentions = [];
      mentions.reset();
      state.quote = state.quoteOf = state.emoji = undefined;
      save();
      media.clear();
      drawHead();
    };
    result.replaceChildren();
    if (!outbox.publish(draft)) {
      result.textContent = t('compose.saveFailed');
      return;
    }
    clear();
    ready();
    area.focus({ preventScroll: true });
  }

  // Saved on every keystroke (one small stored key): a reload a moment after typing must not lose the last words.
  area.addEventListener('input', () => (ready(), (state.text = area.value), save()));
  area.addEventListener('keydown', (e) => {
    if (pressed(e, 'send')) e.preventDefault(), void send();
  });
  area.addEventListener('paste', (e) => {
    if (e.clipboardData?.files.length) e.preventDefault(), media.add(e.clipboardData.files);
  });
  el.addEventListener('dragover', (e) => (e.preventDefault(), el.classList.add('drop-on')));
  el.addEventListener('dragleave', () => el.classList.remove('drop-on'));
  el.addEventListener(
    'drop',
    (e) => (e.preventDefault(), el.classList.remove('drop-on'), media.add(e.dataTransfer?.files)),
  );
  file.addEventListener('change', () => (media.add(file.files), (file.value = '')));
  post.addEventListener('click', () => void send());

  const who = createWho(env, ready);
  el.classList.add('compose');
  el.replaceChildren(
    head,
    mentions.el,
    mentions.preview,
    thumbs,
    h(
      'div',
      { class: 'cbar' },
      who.el,
      h('span', { class: 'grow' }),
      emoji,
      attach,
      file,
      post,
      who.signIn,
    ),
    result,
    outbox.el,
  );
  drawHead();
  outbox.draw();
  if (state.replyTo || state.quote) requestAnimationFrame(() => area.focus());
  return () => {
    state.text = area.value;
    save();
    who.dispose();
    outbox.dispose();
    mentions.dispose();
  };
}
