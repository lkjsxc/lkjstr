import { h, replaceChildren } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import type { AttachmentState } from './compose-media.ts';

// This intent ends at the upload boundary. Only a complete draft enters the outbox.
export function createUploadSubmit(onCancel: () => void) {
  const el = h('div', { class: 'cresult cupload', 'aria-live': 'polite' });
  const cancelButton = h('button', { class: 'btn' }, t('account.cancel'));
  let pending: string | undefined;
  const show = (phase?: 'waiting' | 'failed'): void => {
    if (phase) el.dataset.phase = phase;
    else delete el.dataset.phase;
    replaceChildren(
      el,
      phase === 'waiting' ? [t('compose.uploadQueued'), ' ', cancelButton] : null,
      phase === 'failed' ? h('div', { class: 'error' }, t('compose.uploadPostFailed')) : null,
    );
  };
  const clear = (): void => {
    pending = undefined;
    show();
  };
  const cancel = (): void => {
    if (pending !== undefined) clear();
  };
  cancelButton.addEventListener('click', () => {
    cancel();
    onCancel();
  });
  return {
    el,
    waiting: () => pending !== undefined,
    cancel,
    hold(account: string): void {
      if (pending !== undefined) return;
      pending = account;
      show('waiting');
    },
    advance(state: AttachmentState, account: string, writable: boolean): boolean {
      if (pending === undefined) return false;
      if (state === 'failed') {
        pending = undefined;
        show('failed');
        return false;
      }
      if (!writable || account !== pending) {
        cancel();
        return false;
      }
      if (state === 'uploading') return false;
      clear();
      return true;
    },
    clear,
  };
}
