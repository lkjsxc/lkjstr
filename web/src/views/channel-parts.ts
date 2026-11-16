// Small pieces the channel views share: a channel's face and name, the join button, and the form a channel is
// created or edited with.
import type { ChannelEdit, ChannelRow } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';
import { loadViewState, saveViewSlice } from '../shared/view-state.ts';
import { ability, abilityText, failureText } from './can.ts';
import { act } from './note-actions.ts';
import { avatar } from './parts.ts';
import type { ViewEnv } from './registry.ts';

/** The engine serves channels (protocol 4). Nothing about channels is drawn for one that does not. */
export const CHANNELS_SINCE = 4;

/** A channel whose name has not arrived is shown by a short form of its address, never by hex. */
export const channelName = (c: Pick<ChannelRow, 'name' | 'bech32'>): string =>
  c.name.trim() || `${c.bech32.slice(0, 12)}…${c.bech32.slice(-4)}`;

/** A circle like a person's: the picture, or a flat colour from the id with the first letter of the name. */
export const channelFace = (c: ChannelRow, cls = 'av'): HTMLElement =>
  avatar({ pubkey: c.id, npub: '', name: c.name, picture: c.picture }, cls);

export function joinButton(env: ViewEnv, c: ChannelRow): HTMLElement {
  const can = ability(env.engine);
  return h(
    'button',
    {
      class: can !== 'ok' ? 'btn off' : c.joined ? 'btn' : 'btn primary',
      'data-f': 'join',
      'aria-disabled': can !== 'ok' ? true : null,
      'aria-pressed': c.joined,
      title: can !== 'ok' ? abilityText(can) : c.joined ? t('channel.leave') : null,
      onclick: (e) => (
        e.stopPropagation(),
        void act(env, (as) => ({ a: 'channel.join', as, id: c.id, on: !c.joined }))
      ),
    },
    t(c.joined ? 'channel.joined' : 'channel.join'),
  );
}

/** The form of a new channel, or of the reader's own channel (`of`). `done` gets the channel's id once the
 * engine has taken it, or nothing when the reader gave up. */
export function channelForm(
  env: ViewEnv,
  of: ChannelRow | undefined,
  done: (id?: string) => void,
): HTMLElement {
  type Draft = { id?: string; open: boolean; name: string; about: string; picture?: string };
  const saved = loadViewState<{ channelEdit: Draft }>(env.instance).channelEdit;
  const draft = saved?.open && saved.id === of?.id ? saved : of;
  const finish = (id?: string): void => {
    saveViewSlice(env.instance, 'channelEdit', { open: false });
    done(id);
  };
  const field = (label: Key, value: string, attrs: Record<string, string | number> = {}) =>
    h('input', { type: 'text', value, placeholder: t(label), 'aria-label': t(label), ...attrs });
  const name = field('channel.name', draft?.name ?? '', { maxlength: 80, 'data-f': 'name' });
  const about = field('channel.about', draft?.about ?? '', { maxlength: 400 });
  const picture = field(
    'channel.picture',
    draft?.picture?.startsWith('http') ? draft.picture : '',
    {
      inputmode: 'url',
    },
  );
  const said = h('div', { class: 'asaid error', role: 'status' });
  const save = h('button', { class: 'btn primary', type: 'submit' }, t('channel.save'));
  const ready = (): void => void (save.disabled = !name.value.trim());
  name.addEventListener('input', ready);
  const form = h(
    'form',
    { class: 'cform' },
    name,
    about,
    picture,
    h(
      'div',
      { class: 'actions' },
      save,
      h('button', { class: 'btn', type: 'button', onclick: () => finish() }, t('account.cancel')),
    ),
    said,
  );
  const keep = (): void =>
    saveViewSlice(env.instance, 'channelEdit', {
      id: of?.id,
      open: true,
      name: name.value,
      about: about.value,
      picture: picture.value,
    });
  form.addEventListener('input', keep);
  keep();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!name.value.trim() || ability(env.engine) !== 'ok') return;
    save.disabled = true;
    const channel: ChannelEdit = {
      name: name.value.trim(),
      about: about.value.trim(),
      picture: picture.value.trim() || undefined,
    };
    const r = await env.engine.act({
      a: 'channel.save',
      as: env.engine.me(),
      id: of?.id,
      channel,
    });
    if (r.ok) return finish(r.id ?? of?.id);
    said.textContent = failureText(r.error);
    ready();
  });
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') e.stopPropagation(), finish();
  });
  ready();
  requestAnimationFrame(() => name.focus({ preventScroll: true }));
  return form;
}
