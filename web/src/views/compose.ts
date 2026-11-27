// The composer saves typed drafts and retains failed posts and channel messages for retry.
import type { Delivery, Draft, Failure } from '../engine/protocol.ts';
import { insertDraftEmoji, usedDraftEmoji } from '../shared/emoji-draft.ts';
import { h, replaceChildren } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { icon } from '../shared/icons.ts';
import { keyCaps, pressed } from '../shared/keys.ts';
import { afterSend } from '../shared/platform.ts';
import { kv } from '../shared/storage.ts';
import { loadViewState, saveViewState } from '../shared/view-state.ts';
import { openMenu } from '../wm/menus.ts';
import { ability, abilityText, denied, failureText } from './can.ts';
import { contextLine, quotedCard } from './compose-context.ts';
import { createWarning } from './compose-cw.ts';
import { type ComposeState, composeDraft, restoredDraft } from './compose-draft.ts';
import { createComposeMedia } from './compose-media-state.ts';
import { createMentions } from './compose-mentions.ts';
import { createChannelOutbox } from './compose-outbox.ts';
import { createUploadSubmit } from './compose-upload-submit.ts';
import { createWho } from './compose-who.ts';
import { openEmojiPicker } from './emoji-picker.ts';
import { homeDraftForEdit } from './home-drafts.ts';
import type { ViewEnv } from './registry.ts';
import { sendLine } from './send-state.ts';

/** `channel`: the composer of a channel tab; what it sends is a message in that channel. `reply`: the field under a
 * thread's focus, which always answers that note and takes the keyboard only when asked. */
export function mountCompose(
  el: HTMLElement,
  env: ViewEnv,
  channel?: string,
  reply?: { readonly id: string; readonly name: string },
): () => void {
  const state = loadViewState<ComposeState>(env.instance);
  if (reply) (state.replyTo = reply.id), (state.replyOf = undefined);
  const save = (): void => saveViewState(env.instance, state);
  const area = h('textarea', {
    class: 'ctext',
    rows: channel ? 2 : 4,
    placeholder: reply
      ? t('thread.replyHint', { name: reply.name })
      : t(state.replyTo ? 'compose.replyHint' : channel ? 'channel.say' : 'compose.hint'),
    'aria-label': t('view.compose'),
  });
  area.value = state.text ?? '';
  const queued = createUploadSubmit(() => {
    ready();
    area.focus({ preventScroll: true });
  });
  const edited = (): void => {
    queued.cancel();
    save();
    ready();
  };
  const mentions = createMentions(area, env, state, () => {
    state.text = area.value;
    edited();
  });
  const thumbs = h('div', { class: 'thumbs' });
  const result = h('div', { class: 'cresult', role: 'status' });
  let startingQueuedReply = false;
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
      const picked = insertDraftEmoji(usedDraftEmoji(state.emoji, area.value), p);
      state.emoji = picked.emoji;
      insert(picked.text);
    }),
  );
  const post = h(
    'button',
    { class: 'btn primary', title: keyCaps('send')[0] },
    t(state.replyTo ? 'compose.reply' : 'compose.post'),
  );
  const head = h('div');
  const quoted = h('div');
  const unquote = (): void => {
    state.quote = state.quoteOf = undefined;
    edited();
    drawHead();
  };
  const drawHead = (): void => {
    const unreply = () => ((state.replyTo = state.replyOf = undefined), edited(), drawHead());
    replaceChildren(head, contextLine('compose.replyingTo', state.replyOf, unreply));
    replaceChildren(quoted, state.quote ? quotedCard(state.quoteOf, env, unquote) : null);
  };
  const warning = createWarning(state, edited, () => area.focus({ preventScroll: true }));
  const ready = (): void => {
    const can = ability(env.engine);
    post.hidden = can === 'signed-out';
    post.title = abilityText(can) || (keyCaps('send')[0] ?? '');
    attach.disabled = can !== 'ok';
    post.disabled =
      !!outbox?.full() ||
      queued.waiting() ||
      media.status() === 'failed' ||
      can !== 'ok' ||
      (!area.value.trim() && !media.count() && !state.quote);
  };
  const restore = (draft: Draft): boolean => {
    const uploads = media.status();
    if (uploads === 'uploading') result.textContent = t('compose.uploadWait');
    if (uploads !== 'ready') return false;
    if (area.value || media.count()) {
      openMenu(env.layer, post, [
        {
          label: t('compose.editWhenEmpty'),
          run: () => {
            if (media.status() !== 'ready') return;
            if (
              !outbox.retain({
                text: area.value,
                media: media.uploaded(),
                mentions: state.mentions,
                replyTo: state.replyTo,
                quote: state.quote,
                cw: state.cw,
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
    const next = restoredDraft(state, draft);
    if (!kv.persist(`view:${env.instance}`, next)) {
      result.textContent = t('compose.saveFailed');
      return false;
    }
    Object.assign(state, next);
    area.value = draft.text;
    mentions.reset();
    media.restore(draft.media ?? []);
    warning.set(state.cw);
    save();
    drawHead();
    ready();
    area.focus({ preventScroll: true });
    return true;
  };
  const outbox = createChannelOutbox(env, state.outbox ?? [], ready, showDelivery, restore);
  state.outbox = undefined;
  const media = createComposeMedia(thumbs, env, state, save, refresh);
  function refresh(removed = false): void {
    const postNow = queued.advance(
      removed ? 'failed' : media.status(),
      env.engine.me(),
      ability(env.engine) === 'ok' && !outbox.full(),
    );
    ready();
    if (postNow && !post.disabled) publish();
  }
  function showDelivery(
    relays: readonly Delivery[],
    final: boolean,
    error?: Failure,
    id?: string,
    ms?: number,
    retrying?: number,
  ): void {
    if (error) return replaceChildren(result, h('div', { class: 'error' }, failureText(error)));
    if (!relays.length && retrying === undefined && (!startingQueuedReply || final))
      return replaceChildren(result);
    replaceChildren(result, sendLine(relays, final, id, ms, retrying));
  }
  function send(byKey = false): void {
    ready();
    if (ability(env.engine) === 'locked') return denied(env, 'locked');
    if (post.disabled) return;
    if (media.status() === 'uploading') {
      result.replaceChildren();
      queued.hold(env.engine.me());
      afterSend(area, byKey);
      return ready();
    }
    publish(byKey);
  }
  function publish(byKey?: boolean): void {
    const draft = composeDraft(state, area.value, media.uploaded(), channel);
    const clear = (): void => {
      area.value = state.text = '';
      if (byKey !== undefined) afterSend(area, byKey);
      state.mentions = [];
      mentions.reset();
      state.replyTo = state.replyOf = state.quote = state.quoteOf = state.emoji = undefined;
      state.replyTo = reply?.id;
      warning.set(undefined);
      save();
      media.clear();
      drawHead();
    };
    queued.clear();
    result.replaceChildren();
    startingQueuedReply = byKey === undefined && reply !== undefined;
    if (!outbox.publish(draft, clear)) result.textContent = t('compose.saveFailed');
    startingQueuedReply = false;
    ready();
  }
  const add = (files: FileList | null | undefined): void => {
    if (!files?.length) return;
    queued.cancel();
    media.add(files);
    ready();
  };
  area.addEventListener('input', () => ((state.text = area.value), edited()));
  area.addEventListener('keydown', (e) => {
    if (pressed(e, 'send')) e.preventDefault(), void send(true);
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
  const who = createWho(env, () => refresh());
  el.classList.add('compose');
  el.replaceChildren(
    head,
    warning.field,
    mentions.el,
    mentions.preview,
    thumbs,
    quoted,
    h(
      'div',
      { class: 'cbar' },
      who.el,
      h('span', { class: 'grow' }),
      warning.button,
      emoji,
      attach,
      file,
      post,
      who.signIn,
    ),
    result,
    queued.el,
    outbox.el,
  );
  drawHead();
  outbox.draw();
  const fromHome = homeDraftForEdit(state.fromHomeDraft, env.engine.me());
  if (fromHome && restore(fromHome.draft)) {
    state.fromHomeDraft = undefined;
    save();
    fromHome.discard();
  }
  if (!reply && (state.replyTo || state.quote)) requestAnimationFrame(() => area.focus());
  return () => {
    queued.cancel();
    state.text = area.value;
    save();
    who.dispose();
    outbox.dispose();
    mentions.dispose();
    media.dispose();
  };
}
