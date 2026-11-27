import { afterEach, expect, it } from 'vitest';
import type { ActResult } from '../src/engine/client.ts';
import type { Action } from '../src/engine/protocol.ts';
import { setLang } from '../src/shared/i18n.ts';
import { loadViewState, saveViewState } from '../src/shared/view-state.ts';
import { mountProfileEdit } from '../src/views/profile-edit.ts';
import { problems, valuesOf } from '../src/views/profile-edit-model.ts';
import { avatarFixture, resetAvatarFixtures } from './avatar-support.ts';
import { author, flush, ME, row, setup } from './profile-edit-fixture.ts';

afterEach(() => {
  resetAvatarFixtures();
  document.body.replaceChildren();
  localStorage.clear();
  setLang('en');
});

it('starts from the published fields, previews them and saves the edited whole', async () => {
  const x = setup();
  saveViewState(x.instance, { pubkey: ME });
  mountProfileEdit(x.el, x.env);
  expect(x.el.querySelector('.penote')?.textContent).toBe('Loading your profile…');
  expect(x.field('save').disabled).toBe(true);
  expect(x.env.engine.open).toHaveBeenCalledWith(
    { source: 'profile', pubkey: ME, account: ME },
    expect.anything(),
    x.el,
  );
  x.handlers().rows([row()], true, true);
  expect(x.field('name').value).toBe('Komorebi');
  expect(x.field('about').value).toBe('Reads. Sometimes writes.\n#nostr nostr:npub1friend');
  expect(x.field('picture').value).toBe('https://img.example/face.png');
  expect(x.field('banner').value).toBe('https://img.example/band.png');
  expect(x.field('nip05').value).toBe('_@example.jp');
  expect(x.field('website').value).toBe('https://example.jp');
  expect(x.field('lud16').value).toBe('me@wallet.example');
  expect(x.el.querySelector('.penote')?.textContent).toBe('');
  expect(x.field('save').disabled).toBe(true); // nothing changed yet
  expect(x.field('picture-restore').hidden).toBe(true);

  x.type('name', '木漏れ日');
  x.type('banner', '');
  expect(x.el.querySelector('.pename')?.textContent).toBe('木漏れ日');
  expect((x.el.querySelector('.pepreview .banner') as HTMLElement).style.backgroundImage).toBe('');
  expect(x.field('banner-restore').hidden).toBe(false);
  expect(loadViewState<{ draft: { name: string } }>(x.instance).draft?.name).toBe('木漏れ日');
  expect(x.field('save').disabled).toBe(false);
  x.submit();
  expect(x.field('save').disabled).toBe(true);
  expect(x.field('save').textContent).toBe('Saving…');
  await flush();
  expect(x.act).toHaveBeenCalledWith({
    a: 'profile.save',
    as: ME,
    profile: {
      name: '木漏れ日',
      about: 'Reads. Sometimes writes.\n#nostr nostr:npub1friend',
      picture: 'https://img.example/face.png',
      banner: undefined,
      nip05: '_@example.jp',
      website: 'https://example.jp',
      lud16: 'me@wallet.example',
    },
  });
  expect(x.env.close).toHaveBeenCalled();
  expect(x.env.layer.textContent).toContain('Profile saved');
  expect(loadViewState(x.instance)).toEqual({ pubkey: ME });
});

it('waits for published fields when the first profile row is a display snapshot', () => {
  const x = setup();
  mountProfileEdit(x.el, x.env);
  x.handlers().rows(
    [
      row(ME, {
        edit: undefined,
        author: { ...author(ME), nip05: 'example.jp' },
        about: [
          { k: 'text', text: 'Hi ' },
          { k: 'link', url: 'https://ex.example/a/long/path', text: 'ex.example/a/…' },
          { k: 'text', text: ' ' },
          { k: 'emoji', code: 'neko', url: 'https://e.example/neko.png' },
          { k: 'hashtag', tag: 'nostr' },
        ],
      }),
    ],
    true,
    true,
  );
  expect(x.field('about').value).toBe('');
  expect(x.field('save').disabled).toBe(true);
  expect(x.el.querySelector('.penote')?.textContent).toBe('Loading your profile…');
  const original = '  Hi #nostr\r\nnostr:npub1friend  ';
  x.handlers().patch([{ op: 'update', row: row(ME, { edit: { name: 'K', about: original } }) }]);
  const normalized = original.replace('\r\n', '\n');
  expect(x.field('about').value.replace('\r\n', '\n')).toBe(normalized);
  x.type('about', normalized);
  x.type('nip05', 'example.jp');
  x.submit();
  expect(x.act.mock.calls[0]?.[0]).toMatchObject({
    profile: { name: 'K', about: original, nip05: '_@example.jp' },
  });
});

it('refuses addresses that are not ones, under their fields, and keeps an unchanged data picture', () => {
  const x = setup();
  mountProfileEdit(x.el, x.env);
  const data = 'data:image/png;base64,AAAA';
  x.handlers().rows([row(ME, { edit: { ...row().edit!, picture: data } })], true, true);
  x.type('website', 'example.jp');
  x.type('lud16', 'wallet');
  x.type('banner', 'http://img.example/b.png');
  x.submit();
  expect(x.act).not.toHaveBeenCalled();
  expect(x.field('website-error').textContent).toBe(
    'A website address starts with https:// or http://',
  );
  expect(x.field('lud16-error').textContent).toBe('Write it as name@example.com');
  expect(x.field('banner-status').textContent).toBe('An image address starts with https://');
  expect(x.field('picture-status').textContent).toBe('');
  x.type('website', 'https://example.jp/');
  x.type('lud16', '');
  x.type('banner', 'https://img.example/b.png');
  x.submit();
  expect(x.act.mock.calls[0]?.[0]).toMatchObject({ profile: { picture: data, lud16: undefined } });
});

it('uploads a picture file into its field with progress, and says why one fails', async () => {
  const x = setup();
  const faces = avatarFixture();
  faces.root.append(x.el);
  mountProfileEdit(x.el, x.env);
  x.handlers().rows([row()], true, true);
  let finish: (r: ActResult) => void = () => {};
  x.act.mockImplementationOnce(
    (_a, w) =>
      new Promise((resolve) => {
        w?.progress?.(50, 100, {
          t: 'progress',
          req: 'r',
          sent: 50,
          total: 100,
          phase: 'uploading',
          server: 'https://media.example.jp',
        });
        finish = resolve;
      }),
  );
  const choose = (f: File) => {
    const input = x.field('picture-file');
    Object.defineProperty(input, 'files', { value: [f], configurable: true });
    input.dispatchEvent(new Event('change'));
  };
  choose(new File([new Uint8Array([1, 2, 3])], 'me.png', { type: 'image/png' }));
  await flush();
  const upload = x.act.mock.calls[0]?.[0] as Extract<Action, { a: 'upload' }>;
  expect(upload).toMatchObject({ a: 'upload', as: ME, name: 'me.png', mime: 'image/png' });
  expect(upload.bytes.byteLength).toBe(3);
  expect(x.field('picture-status').textContent).toBe('Uploading to media.example.jp…');
  expect(x.field('save').disabled).toBe(true); // nothing is saved while an upload runs
  expect(x.field('picture').disabled).toBe(true);
  finish({
    t: 'result',
    req: 'r',
    ok: true,
    uploaded: { url: 'https://media.example.jp/new.png', type: 'image', mime: 'image/png' },
  } as ActResult);
  await flush();
  expect(x.field('picture').value).toBe('https://media.example.jp/new.png');
  expect(x.el.querySelector('.peface img')?.getAttribute('src')).toBe(
    'https://media.example.jp/new.png',
  );
  expect(faces.wants()).toHaveLength(0);
  expect(x.field('save').disabled).toBe(false);

  choose(new File(['x'], 'notes.txt', { type: 'text/plain' }));
  expect(x.field('picture-status').textContent).toBe('Choose an image file');
  x.act.mockResolvedValueOnce({ t: 'result', req: 'r', ok: false, error: { code: 'rejected' } });
  choose(new File([new Uint8Array([1])], 'b.png', { type: 'image/png' }));
  await flush();
  await flush();
  expect(x.field('picture-status').className).toContain('error');
  expect(x.field('picture').value).toBe('https://media.example.jp/new.png');
  x.field('picture-restore').click();
  expect(x.field('picture').value).toBe('https://img.example/face.png');
});

it('keeps the form and says the failure when the save is refused', async () => {
  const x = setup();
  mountProfileEdit(x.el, x.env);
  x.handlers().rows([row()], true, true);
  x.act.mockResolvedValueOnce({
    t: 'result',
    req: 'r',
    ok: false,
    error: { code: 'rejected', message: 'blocked: spam filter' },
  });
  x.type('about', 'airdrop');
  x.submit();
  await flush();
  expect(x.env.close).not.toHaveBeenCalled();
  expect(x.el.querySelector('.asaid')?.textContent).toContain('blocked: spam filter');
  expect(x.field('about').value).toBe('airdrop');
  expect(x.field('save').disabled).toBe(false);
  expect(x.field('save').textContent).toBe('Save');
});

it('accepts an address an upload of the form answered with, whatever its scheme', () => {
  const base = valuesOf(row().edit!);
  const v = { ...base, picture: 'blob:http://localhost/1' };
  expect(problems(v, base)).toEqual({ picture: 'pedit.badImage' });
  expect(problems(v, base, new Set(['blob:http://localhost/1']))).toEqual({});
});
