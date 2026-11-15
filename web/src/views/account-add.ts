// The ways to sign in. Two actions stand together with nothing between them: a browser extension, or a new
// account. A key or a bunker address is typed into a field that never echoes, kept behind one quiet line below
// them. Each way says what it is waiting for and, when it fails, what happened and the way forward, right under
// where it was pressed. A typed key leaves the field the moment it is sent and is held nowhere
// else; nothing a signer or the engine says back is shown, so a key can never surface in a message.
import type { Action, Failure } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';
import { canKey, creatingAccount, markCreated } from './account-key.ts';
import type { ViewEnv } from './registry.ts';

type Way = 'extension' | 'key' | 'create';

/** What a failure of one way is called. A remote signer's refusal is not an extension's. */
const failure = (way: Way, remote: boolean, code: Failure['code'] | undefined): Key => {
  if (code === 'signer-refused') return remote ? 'account.fail.remote' : 'account.fail.refused';
  if (code === 'signer-missing') return 'account.fail.missing';
  if (code === 'rejected' && way === 'key') return 'account.fail.rejected';
  if (code === 'too-large') return 'account.fail.full';
  return `error.${code ?? 'internal'}` as Key;
};

export function mountAdd(env: ViewEnv): { el: HTMLElement; sync(): void } {
  const pair = h('div', { class: 'asaid' }); // under the two buttons, for either of them
  const said: Record<Way, HTMLElement> = {
    extension: pair,
    key: h('div', { class: 'asaid' }),
    create: pair,
  };
  let busy = false;
  const say = (way: Way, text: string, failed = false): void => {
    for (const el of Object.values(said)) {
      el.textContent = '';
      el.className = 'asaid';
      el.removeAttribute('role');
    }
    said[way].textContent = text;
    said[way].className = failed ? 'asaid error' : 'asaid muted';
    if (failed) said[way].setAttribute('role', 'alert');
  };
  const run = async (way: Way, action: Action, waiting: Key, remote = false): Promise<void> => {
    if (busy) return;
    const from = document.activeElement as HTMLElement | null;
    busy = true;
    sync();
    say(way, t(waiting));
    creatingAccount(way === 'create');
    const r = await env.engine.act(action);
    creatingAccount(false);
    busy = false;
    sync();
    // The control that was pressed was off while it waited: the keyboard goes back to it.
    if (from?.isConnected && document.activeElement === document.body)
      from.focus({ preventScroll: true });
    if (!r.ok) return say(way, t(failure(way, remote, r.error?.code)), true);
    say(way, '');
    // The engine has already said who is signed in: a created account's key is shown at once.
    if (way === 'create') markCreated(env.engine.me());
  };

  const extension = h(
    'button',
    {
      class: 'btn primary wide',
      'data-f': 'extension',
      onclick: () =>
        void run('extension', { a: 'account.add', how: 'extension' }, 'account.busy.extension'),
    },
    t('account.add.extension'),
  );
  const field = h('input', {
    type: 'password',
    name: 'lkjstr-key',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    'data-1p-ignore': true,
    'data-lpignore': 'true',
    placeholder: t('account.add.key'),
    'aria-label': t('account.add.keyLabel'),
    oninput: () => {
      field.removeAttribute('aria-invalid');
      sync();
    },
  });
  const submit = h(
    'button',
    { class: 'btn', type: 'submit', 'data-f': 'key' },
    t('account.add.submit'),
  );
  const form = h(
    'form',
    {
      class: 'addrow',
      autocomplete: 'off',
      onsubmit: (e) => {
        e.preventDefault();
        const key = field.value.trim();
        field.value = ''; // sent once, kept nowhere
        if (!key) return;
        const remote = key.startsWith('bunker://');
        void run(
          'key',
          { a: 'account.add', how: 'key', key },
          remote ? 'account.busy.remote' : 'account.busy.key',
          remote,
        );
      },
    },
    field,
    submit,
  );
  const create = h(
    'button',
    {
      class: 'btn wide',
      'data-f': 'create',
      onclick: () => void run('create', { a: 'account.add', how: 'create' }, 'account.busy.key'),
    },
    t('account.add.create'),
  );
  const keyRow = h('div', { class: 'away', hidden: true }, form, said.key);
  const other: HTMLElement = h(
    'button',
    {
      class: 'amore',
      'data-f': 'other',
      'aria-expanded': false,
      onclick: () => {
        keyRow.hidden = !keyRow.hidden;
        other.setAttribute('aria-expanded', String(!keyRow.hidden));
        if (!keyRow.hidden) field.focus();
      },
    },
    t('account.add.other'),
  );
  function sync(): void {
    extension.disabled = create.disabled = field.disabled = busy;
    submit.disabled = busy || !field.value.trim();
    // An engine that cannot show a key afterwards is not asked to make one.
    create.hidden = !canKey(env);
  }
  sync();
  return {
    el: h(
      'div',
      { class: 'aadd' },
      h('div', { class: 'apair' }, extension, create),
      pair,
      other,
      keyRow,
    ),
    sync,
  };
}
