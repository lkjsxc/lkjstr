// The Edit profile tab (interface-profile.md P1). It opens from the reader's own profile header, reads that
// profile once to start from and keeps what is typed with the tab. A preview at its top shows banner, face and
// name as they will look. Save publishes the whole profile (`profile.save`) and closes the tab; a failure stays
// in the form in words. The form is one standing element: rows that arrive later never rewrite a field.
import type { Subscription } from '../engine/client.ts';
import { applyOps } from '../engine/ops.ts';
import type { ProfileEdit, ProfileRow, Row } from '../engine/protocol.ts';
import { h, replaceChildren } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';
import type { Disposer } from '../shared/signal.ts';
import { loadViewState, saveViewState } from '../shared/view-state.ts';
import { ability, abilityText, failureText } from './can.ts';
import { avatar, showBanner, toast } from './parts.ts';
import { createImageField, type ImageField } from './profile-edit-image.ts';
import {
  FIELDS,
  type Field,
  problems,
  profileOf,
  same,
  type Values,
  valuesOf,
} from './profile-edit-model.ts';
import type { ViewEnv } from './registry.ts';

type State = { pubkey?: string; title?: string; draft?: Values; base?: Values };

/** Whether this profile row is the active account's and that account can publish: the only case the header
 * offers Edit profile. */
export const editable = (row: ProfileRow, env: ViewEnv): boolean =>
  row.self && row.author.pubkey === env.engine.me() && ability(env.engine) === 'ok';

export function mountProfileEdit(el: HTMLElement, env: ViewEnv): Disposer {
  const state = loadViewState<State>(env.instance);
  const pubkey = state.pubkey ?? env.engine.me();
  let base: Values | undefined = state.base;
  let saving = false;
  const keep = (draft: Values | undefined): void =>
    saveViewState(env.instance, { ...loadViewState<State>(env.instance), pubkey, draft, base });

  const banner = h('div', { class: 'banner' });
  const face = h('span', { class: 'peface' });
  const shownName = h('bdi', { class: 'pename' });
  const preview = h('div', { class: 'pepreview', 'aria-hidden': 'true' }, banner, face, shownName);
  const note = h('div', { class: 'penote muted', role: 'status' }, t('pedit.loading'));
  const said = h('div', { class: 'asaid error', role: 'alert' });
  const errors = new Map<Field, HTMLElement>(); // bound: the seven fields

  const text = (f: Exclude<Field, 'picture' | 'banner' | 'about'>, label: Key, mode: string) => {
    const input = h('input', {
      id: `pe-${f}-${env.instance}`,
      type: 'text',
      inputmode: mode,
      autocomplete: 'off',
      spellcheck: f === 'name' ? null : 'false',
      maxlength: f === 'name' ? 100 : 300,
      'data-f': f,
    });
    return { input, el: row(f, label, input) };
  };
  const row = (f: Field, label: Key, control: HTMLElement): HTMLElement => {
    const err = h('div', { class: 'pestatus error', 'data-f': `${f}-error` });
    errors.set(f, err);
    return h(
      'div',
      { class: 'pefield' },
      h('label', { class: 'pelabel', for: control.id }, t(label)),
      control,
      err,
    );
  };
  const changed = (): void => {
    if (!base) return;
    const v = values();
    keep(v);
    draw(v);
  };
  const image = (field: 'picture' | 'banner', label: Key): ImageField =>
    createImageField(env, { field, label, value: '', saved: '', changed });
  const picture = image('picture', 'pedit.picture');
  const bannerField = image('banner', 'pedit.banner');
  const name = text('name', 'pedit.name', 'text');
  const about = h('textarea', {
    id: `pe-about-${env.instance}`,
    rows: 5,
    maxlength: 2000,
    'data-f': 'about',
  });
  const nip05 = text('nip05', 'pedit.nip05', 'email');
  const website = text('website', 'pedit.website', 'url');
  const lud16 = text('lud16', 'pedit.lud16', 'email');
  const inputs: Record<Field, HTMLInputElement | HTMLTextAreaElement | ImageField> = {
    name: name.input,
    about,
    picture,
    banner: bannerField,
    nip05: nip05.input,
    website: website.input,
    lud16: lud16.input,
  };
  const get = (f: Field): string => {
    const x = inputs[f];
    return 'set' in x ? x.value() : x.value;
  };
  const values = (): Values => Object.fromEntries(FIELDS.map((f) => [f, get(f)])) as Values;
  const fill = (v: Values): void => {
    for (const f of FIELDS) {
      const x = inputs[f];
      if ('set' in x) x.set(v[f]);
      else x.value = v[f];
    }
  };

  const save = h(
    'button',
    { class: 'btn primary', type: 'submit', 'data-f': 'save' },
    t('pedit.save'),
  );
  const cancel = h(
    'button',
    { class: 'btn', type: 'button', 'data-f': 'cancel', onclick: () => finish() },
    t('account.cancel'),
  );
  const form = h(
    'form',
    { class: 'peform', novalidate: true },
    preview,
    note,
    picture.el,
    bannerField.el,
    name.el,
    row('about', 'pedit.about', about),
    nip05.el,
    website.el,
    lud16.el,
    h('div', { class: 'actions' }, save, cancel),
    said,
  );

  /** Why the form cannot be saved right now, said in the note line; '' when it can. */
  const blocked = (): string => {
    if (pubkey !== env.engine.me()) return t('pedit.other');
    const can = ability(env.engine);
    return can === 'ok' ? '' : abilityText(can);
  };
  let fresh = false;
  const draw = (v: Values): void => {
    const why = blocked();
    note.textContent = why || (!base ? t('pedit.loading') : fresh ? t('pedit.fresh') : '');
    const off = !base || Boolean(why) || saving;
    for (const x of [name.input, about, nip05.input, website.input, lud16.input]) x.disabled = off;
    picture.enable(!off);
    bannerField.enable(!off);
    const uploading = picture.busy() || bannerField.busy();
    save.disabled = off || uploading || (base ? same(v, base) : true);
    save.textContent = t(saving ? 'pedit.saving' : 'pedit.save');
    // The preview: what an image address that is not one yet would show is the flat face.
    const shown = (s: string): string | undefined =>
      /^(https:|data:image\/|blob:)/.test(s.trim()) && URL.canParse(s.trim())
        ? s.trim()
        : undefined;
    showBanner(banner, shown(v.banner));
    replaceChildren(
      face,
      avatar({ pubkey, npub: '', name: v.name, picture: shown(v.picture) }, 'av xl'),
    );
    shownName.textContent = v.name.trim();
  };

  const seat = (r: ProfileRow, edit: ProfileEdit): void => {
    const published = valuesOf(edit);
    fresh = !r.author.profileId && FIELDS.every((field) => !published[field]);
    const draft = loadViewState<State>(env.instance).draft;
    if (!base) fill(draft ?? published);
    const b = (base ??= published);
    picture.rebase(b.picture);
    bannerField.rebase(b.banner);
    keep(draft);
    draw(values());
    if (!blocked()) requestAnimationFrame(() => name.input.focus({ preventScroll: true }));
  };
  // A restored tab has its form at once, from what it was saving against; the row still says what it is.
  if (base) {
    fill(state.draft ?? base);
    picture.rebase(base.picture);
    bannerField.rebase(base.banner);
  }

  let rows: Row[] = [];
  let seated = false;
  const take = (next: Row[]): void => {
    rows = next;
    const r = rows.find((x): x is ProfileRow => x.kind === 'profile');
    if (!r?.edit || !r.self || r.author.pubkey !== pubkey || seated) return;
    seated = true;
    seat(r, r.edit);
  };
  const sub: Subscription = env.engine.open(
    { source: 'profile', pubkey, account: pubkey || undefined },
    { rows: (r) => take([...r]), patch: (ops) => take(applyOps(rows, ops)) },
    el,
  );
  sub.window('top', 0, 1);
  sub.visible(env.visible.get());

  const finish = (): void => {
    saveViewState(env.instance, { pubkey });
    env.close();
  };
  const show = (bad: Partial<Record<Field, Key>>): Field | undefined => {
    for (const [f, err] of errors) err.textContent = bad[f] ? t(bad[f]) : '';
    for (const f of ['picture', 'banner'] as const) {
      const status = (f === 'picture' ? picture : bannerField).el.querySelector('.pestatus');
      if (status && bad[f]) (status.className = 'pestatus error'), (status.textContent = t(bad[f]));
    }
    return FIELDS.find((f) => bad[f]);
  };
  form.addEventListener('input', () => {
    said.textContent = '';
    changed();
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!base || saving || save.disabled || blocked()) return;
    const v = values();
    const first = show(problems(v, base, new Set([...picture.uploaded, ...bannerField.uploaded])));
    if (first) {
      const x = inputs[first];
      ('set' in x ? x.input : x).focus();
      return;
    }
    saving = true;
    said.textContent = '';
    draw(v);
    const r = await env.engine.act({ a: 'profile.save', as: pubkey, profile: profileOf(v, base) });
    saving = false;
    if (r.ok) {
      toast(env.layer, t('pedit.saved'));
      return finish();
    }
    said.textContent = failureText(r.error);
    draw(values());
  });

  const offs = [
    env.visible.subscribe((on) => sub.visible(on)),
    env.engine.accounts.subscribe(() => draw(values())),
  ];
  el.append(h('div', { class: 'view pedit' }, form));
  draw(values());
  return () => {
    for (const off of offs) off();
    sub.close();
    picture.dispose();
    bannerField.dispose();
  };
}
