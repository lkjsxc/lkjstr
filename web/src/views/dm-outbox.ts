// Sent-but-unobserved and failed private drafts remain explicit; retry is always a new deliberate send.
import type { Author, DmFailedDraft } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { openAccountUnlock } from './account-vault.ts';
import { dmError } from './dm-parts.ts';
import { faceButton, nameButton } from './parts.ts';
import type { ViewEnv } from './registry.ts';

export function dmFailure(item: DmFailedDraft): string {
  const delivery = item.dmDelivery,
    code = item.error?.code;
  if (delivery && delivery.accepted > 0 && delivery.accepted < delivery.total)
    return t('dm.fail.partial', { ok: delivery.accepted, all: delivery.total });
  if (code === 'signer-timeout') return t('dm.fail.timeout');
  if (code === 'signer-refused') return t('dm.fail.refused');
  if (code === 'unsupported') return t('dm.signerOld');
  if (delivery?.accepted === 0) return t('dm.fail.none');
  return code ? dmError(code) : t('compose.retained');
}
export function renderDmOutbox(o: {
  item: DmFailedDraft;
  busy: boolean;
  inactive?: boolean;
  author: Author;
  env: ViewEnv;
  retry(): void;
  edit(): void;
  drop(): void;
}): HTMLElement {
  const { item, env } = o;
  const locked =
    item.error?.code === 'signer-missing' &&
    env.engine.accounts.get().accounts.find((a) => a.author.pubkey === o.author.pubkey)?.locked;
  const action = (
    key: 'compose.retry' | 'compose.edit' | 'compose.drop',
    run: () => void,
  ): HTMLElement =>
    h('button', { class: 'btn', disabled: o.inactive === true, onclick: run }, t(key));
  const main = h(
    'div',
    { class: 'nmain' },
    h(
      'div',
      { class: 'nhead' },
      nameButton(o.author, env),
      o.busy ? h('time', null, t('compose.pending')) : null,
    ),
    h('div', { class: 'text' }, item.draft.text),
  );
  if (!o.busy) {
    main.append(
      h(
        'div',
        { class: item.error || item.dmDelivery ? 'error' : 'muted' },
        locked ? t('dm.locked') : dmFailure(item),
      ),
    );
    main.append(
      h(
        'div',
        { class: 'actions' },
        locked
          ? h(
              'button',
              { class: 'btn', onclick: () => openAccountUnlock(env, o.author.pubkey) },
              t('account.unlock'),
            )
          : item.error?.code === 'unsupported'
            ? null
            : action('compose.retry', o.retry),
        action('compose.edit', o.edit),
        action('compose.drop', o.drop),
      ),
    );
  }
  return h(
    'div',
    { class: `note dm-outbox-row${o.busy ? ' pending' : ''}`, 'data-key': `pending:${item.key}` },
    h('div', { class: 'nrow' }, faceButton(o.author, env), main),
  );
}
