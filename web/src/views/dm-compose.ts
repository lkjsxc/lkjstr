// M3's private input and bounded outbox use encrypted engine drafts, never the public composer's storage.
import type {
  Account,
  Author,
  DmDraft,
  DmFailedDraft,
  DmMessage,
  DmSnapshot,
  Emoji,
} from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { icon } from '../shared/icons.ts';
import { keyCaps, pressed } from '../shared/keys.ts';
import { createDmEditor } from './dm-compose-edit.ts';
import type { createDmDraftPool } from './dm-draft-pool.ts';
import { transmitDm } from './dm-draft-send.ts';
import { createDmDraftStore } from './dm-draft-store.ts';
import { renderDmOutbox } from './dm-outbox.ts';
import { dmAuthor, dmError, dmNames, inboxSetup } from './dm-parts.ts';
import { emojiTag, openEmojiPicker } from './emoji-picker.ts';
import { plainName } from './parts.ts';
import type { ViewEnv } from './registry.ts';

export function createDmCompose(o: {
  env: ViewEnv;
  account: Account;
  peers: readonly string[];
  drafts?: ReturnType<typeof createDmDraftPool>;
  changed(): void;
  known(id: string): DmMessage | undefined;
}) {
  const { env, account, peers } = o,
    owner = account.author.pubkey;
  let stopped = false,
    people: ReadonlyMap<string, Author> = new Map([[owner, account.author]]);
  let blocked: readonly string[] = [],
    error = '',
    editing = false;
  const area = h('textarea', { class: 'ctext', rows: 2, 'aria-label': t('dm.message') });
  const context = h('div'),
    status = h('div', { class: 'muted', role: 'status' });
  const storageError = h('div', { class: 'error', role: 'status' });
  const storageRetry = h(
    'button',
    {
      class: 'btn',
      hidden: true,
      onclick: () => {
        error = '';
        store.retry();
      },
    },
    t('dm.retry'),
  );
  const emoji = h(
    'button',
    { class: 'icon', title: t('compose.emoji'), 'aria-label': t('compose.emoji') },
    icon('smile'),
  );
  const send = h('button', { class: 'btn primary', title: keyCaps('send')[0] }, t('dm.send'));
  const form = h(
    'div',
    { class: 'csay compose' },
    context,
    area,
    status,
    h('div', { class: 'cbar' }, emoji, h('div', { class: 'grow' }), send),
    storageError,
    storageRetry,
  );
  const unavailable = h('div'),
    outbox = h('div', { class: 'dm-outbox' });
  const el = h('div', { class: 'dm-compose' }, unavailable, form, outbox);
  const store =
    o.drafts?.get(account, peers) ??
    createDmDraftStore({ env, account: owner, recipients: peers, changed() {}, failed() {} });
  const detach = store.attach({
    changed: () => draw(),
    failed: (failure) => {
      error = dmError(failure.code);
      if (!stopped) draw();
    },
  });
  const length = (): number => new TextEncoder().encode(area.value).length;
  const remove = (key: string): void =>
    store.replace({
      ...store.get(),
      failed: store.get().failed.filter((item) => item.key !== key),
    });
  const draft = (): DmDraft => ({ ...store.get().draft, recipients: peers, text: area.value });
  const editor = createDmEditor({ env, anchor: send, area, store, current: draft });
  const write = (): void => {
    if (stopped || !store.ready()) return;
    error = '';
    store.draft(draft());
  };
  const transmit = (item: DmFailedDraft): void => {
    if (!stopped && !blocked.length) transmitDm({ env, account: owner, store, key: item.key });
  };
  const submit = (): void => {
    if (send.disabled || stopped) return;
    if (store.get().failed.length >= 32) {
      error = dmError('too-large');
      draw();
      return;
    }
    const item = { key: crypto.randomUUID(), draft: draft() };
    store.replace({
      draft: { recipients: peers, text: '' },
      failed: [item, ...store.get().failed],
    });
    area.value = '';
    area.focus({ preventScroll: true });
    void transmit(item);
  };
  function draw(): void {
    if (stopped) return;
    const state = store.get();
    const kept = state.failed.filter((item) => !!item.error || !item.id || !o.known(item.id));
    if (!store.held() && kept.length !== state.failed.length) {
      store.replace({ ...state, failed: kept });
      return;
    }
    const saved = state.draft;
    if (!editing && area.value !== saved.text) area.value = saved.text;
    area.placeholder =
      peers.length > 1
        ? t('dm.sayGroup', { n: peers.length })
        : t('dm.say', { name: dmNames(peers, people) });
    area.disabled = !store.ready();
    emoji.disabled = !store.ready();
    const tooLong = length() > 16 * 1024;
    send.disabled =
      !store.ready() ||
      !area.value.trim() ||
      tooLong ||
      !!blocked.length ||
      state.failed.length >= 32;
    send.classList.toggle('primary', !send.disabled);
    status.textContent = store.loading() ? t('dm.loading') : tooLong ? t('dm.tooLong') : '';
    storageRetry.hidden = !store.retryable();
    storageError.textContent = error;
    context.replaceChildren();
    if (saved.replyTo) {
      const message = o.known(saved.replyTo);
      context.append(
        h(
          'div',
          { class: 'cctx' },
          h(
            'span',
            { class: 'muted clip' },
            message
              ? `${t('compose.replyingTo', { name: plainName(dmAuthor(people, message.author)) })} ${message.text.split('\n')[0] ?? ''}`
              : t('dm.replyGone'),
          ),
          h(
            'button',
            {
              class: 'x',
              title: t('compose.drop'),
              'aria-label': t('compose.drop'),
              onclick: () => store.draft({ ...draft(), replyTo: undefined }),
            },
            '×',
          ),
        ),
      );
    }
    form.hidden = blocked.length > 0;
    unavailable.replaceChildren(
      ...(!blocked.length
        ? []
        : blocked.includes(owner)
          ? [inboxSetup(env)]
          : [
              h(
                'div',
                { class: 'fstate muted' },
                t('dm.noInbox', { name: dmNames(blocked, people) }),
              ),
            ]),
    );
    outbox.replaceChildren(
      ...state.failed
        .filter((item) => !!item.error || !item.id || !o.known(item.id))
        .map((item) =>
          renderDmOutbox({
            item,
            busy: (store.busy(item.key) && !item.error) || (!!item.id && !item.error),
            inactive: !store.ready() || store.busy(item.key),
            author: account.author,
            env,
            retry: () => void transmit(item),
            drop: () => {
              if (store.ready()) remove(item.key);
            },
            edit: () => editor.edit(item),
          }),
        ),
    );
    o.changed();
  }
  area.addEventListener('input', () => {
    editing = true;
    write();
    editing = false;
  });
  area.addEventListener('keydown', (event) => {
    if (pressed(event, 'send')) {
      event.preventDefault();
      submit();
    }
  });
  send.addEventListener('click', submit);
  emoji.addEventListener('click', () =>
    openEmojiPicker(env, emoji, (picked) => {
      if (stopped || !store.ready()) return;
      const at = area.selectionStart,
        end = area.selectionEnd;
      area.setRangeText(picked.emoji, at, end, 'end');
      let custom: readonly Emoji[] | undefined = store.get().draft.emoji;
      const tag = emojiTag(picked);
      // A private draft keeps code and picture only.
      if (tag)
        custom = [
          ...(custom ?? []).filter((e) => e.code !== tag.code),
          { code: tag.code, url: tag.url },
        ];
      store.draft({ ...draft(), emoji: custom });
      area.focus({ preventScroll: true });
    }),
  );
  draw();
  return {
    el,
    reply(message: DmMessage): void {
      store.draft({ ...draft(), replyTo: message.id });
      area.focus({ preventScroll: true });
    },
    update(snapshot: DmSnapshot, authors: ReadonlyMap<string, Author>): void {
      people = authors;
      blocked = snapshot.blocked ?? [];
      if (!snapshot.blocked && snapshot.error === 'not-found' && account.inbox?.length === 0)
        blocked = [owner];
      const current = store.get();
      const kept = current.failed.filter((item) => !!item.error || !item.id || !o.known(item.id));
      if (!store.held() && kept.length !== current.failed.length)
        store.replace({ ...current, failed: kept });
      else draw();
    },
    dispose(): void {
      stopped = true;
      editor.dispose();
      detach();
      if (!o.drafts) store.dispose();
      area.value = '';
      context.replaceChildren();
      outbox.replaceChildren();
      people = new Map();
      blocked = [];
    },
  };
}
