import { afterEach, expect, it } from 'vitest';
import type { ProfileRow } from '../src/engine/protocol.ts';
import { setLang } from '../src/shared/i18n.ts';
import { saveViewState } from '../src/shared/view-state.ts';
import { mountProfileEdit } from '../src/views/profile-edit.ts';
import { renderProfile } from '../src/views/rows.ts';
import { ME, OTHER, row, setup } from './profile-edit-fixture.ts';

afterEach(() => {
  localStorage.clear();
  setLang('en');
});

it('offers Edit profile only on the active writable account’s own header', () => {
  const button = (x: ReturnType<typeof setup>, r: ProfileRow) =>
    renderProfile(r, x.env).querySelector('[data-f="edit-profile"]');
  const own = setup();
  const pressed = button(own, row()) as HTMLButtonElement;
  expect(pressed?.textContent).toBe('Edit profile');
  pressed.click();
  expect(own.env.open).toHaveBeenCalledWith(
    'profile-edit',
    { pubkey: ME, title: 'Edit profile' },
    expect.anything(),
  );
  expect(button(setup('none'), row())).toBeNull(); // read-only
  expect(button(own, row(OTHER))).toBeNull(); // someone else
  expect(button(setup('local', OTHER), row(ME, { self: false }))).toBeNull(); // another account in use
});

it('restores a draft with its tab and refuses to save as another or a read-only account', () => {
  const x = setup('local', OTHER);
  const base = {
    name: 'Komorebi',
    about: '',
    picture: '',
    banner: '',
    nip05: '',
    website: '',
    lud16: '',
  };
  saveViewState(x.instance, { pubkey: ME, base, draft: { ...base, name: 'Draft' } });
  mountProfileEdit(x.el, x.env);
  expect(x.field('name').value).toBe('Draft');
  expect(x.el.querySelector('.penote')?.textContent).toBe(
    'This profile is not the account in use. Switch to it to edit.',
  );
  expect(x.field('save').disabled).toBe(true);
  expect(x.field('name').disabled).toBe(true);

  const ro = setup('none');
  mountProfileEdit(ro.el, ro.env);
  ro.handlers().rows([row()], true, true);
  expect(ro.field('save').disabled).toBe(true);
  expect(ro.el.querySelector('.penote')?.textContent).not.toBe('');
});
