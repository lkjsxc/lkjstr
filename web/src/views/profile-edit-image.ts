// One picture of the profile editor (the face or the banner): an address typed or pasted, or a file uploaded
// through the engine (`upload`), which puts the uploaded address in the field. Remove empties it; Restore brings
// back the saved one. Progress and failure are one line under the row.
import { hostOf } from '../shared/address.ts';
import { h, replaceChildren } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';
import { failureText } from './can.ts';
import { watchList } from './lists.ts';
import type { ViewEnv } from './registry.ts';

const MOST = 20 * 1024 * 1024; // as an attachment

export type ImageField = {
  readonly el: HTMLElement;
  readonly input: HTMLInputElement;
  value(): string;
  set(value: string): void;
  /** The base the Restore button returns to. */
  rebase(saved: string): void;
  busy(): boolean;
  /** Addresses uploads of this field answered with (at most a few per form). */
  readonly uploaded: ReadonlySet<string>;
  enable(on: boolean): void;
  dispose(): void;
};

export function createImageField(
  env: ViewEnv,
  o: { field: 'picture' | 'banner'; label: Key; value: string; saved: string; changed: () => void },
): ImageField {
  let saved = o.saved;
  let busy = false;
  let abort: AbortController | undefined;
  let enabled = true;
  let server = '';
  const uploaded = new Set<string>();
  let offServers: (() => void) | undefined;
  const id = `pe-${o.field}-${env.instance}`;
  const input = h('input', {
    id,
    type: 'text',
    inputmode: 'url',
    autocomplete: 'off',
    spellcheck: 'false',
    placeholder: t('pedit.imageUrl'),
    'data-f': o.field,
    value: o.value,
  });
  const file = h('input', {
    type: 'file',
    accept: 'image/*',
    hidden: true,
    'data-f': `${o.field}-file`,
  });
  const upload = h(
    'button',
    { class: 'btn', type: 'button', 'data-f': `${o.field}-upload`, onclick: () => file.click() },
    t('pedit.upload'),
  );
  const remove = h(
    'button',
    { class: 'btn', type: 'button', 'data-f': `${o.field}-remove`, onclick: () => put('') },
    t('pedit.remove'),
  );
  const restore = h(
    'button',
    { class: 'btn', type: 'button', 'data-f': `${o.field}-restore`, onclick: () => put(saved) },
    t('pedit.restore'),
  );
  const status = h('div', { class: 'pestatus', role: 'status', 'data-f': `${o.field}-status` });
  const draw = (): void => {
    const v = input.value.trim();
    remove.hidden = !v;
    restore.hidden = v === saved.trim();
    for (const b of [upload, remove, restore]) b.disabled = busy || !enabled;
    input.disabled = busy || !enabled;
  };
  const put = (value: string): void => {
    abort?.abort();
    input.value = value;
    status.replaceChildren();
    draw();
    o.changed();
  };
  const fail = (text: string): void => {
    status.className = 'pestatus error';
    status.textContent = text;
  };
  const send = async (f: File): Promise<void> => {
    status.className = 'pestatus';
    status.replaceChildren();
    if (!f.type.startsWith('image/')) return fail(t('pedit.notImage'));
    if (f.size > MOST) return fail(t('error.too-large'));
    const run = new AbortController();
    abort = run;
    busy = true;
    draw();
    o.changed();
    const bar = h('i');
    const where = (): string => (server ? hostOf(server) : t('upload.server'));
    const said = h('span', { class: 'muted' }, t('upload.discovering', { server: where() }));
    replaceChildren(status, h('span', { class: 'prog' }, bar), said);
    try {
      const bytes = await f.arrayBuffer();
      if (run.signal.aborted) return;
      const r = await env.engine.act(
        { a: 'upload', as: env.engine.me(), name: f.name, mime: f.type, bytes },
        {
          uploadSignal: run.signal,
          progress(sent, total, detail) {
            if (run.signal.aborted) return;
            bar.style.width = `${Math.round((sent / Math.max(total, 1)) * 100)}%`;
            server = detail?.server ?? server;
            said.textContent = t(`upload.${detail?.phase ?? 'uploading'}` as Key, {
              server: where(),
            });
          },
        },
      );
      if (run.signal.aborted) return;
      if (r.ok && r.uploaded) {
        input.value = r.uploaded.url;
        uploaded.add(r.uploaded.url);
        status.replaceChildren();
      } else
        fail(
          r.error?.code === 'not-found' && !r.error.message
            ? t('servers.none')
            : r.error?.code === 'signer-missing'
              ? t('upload.signerMissing')
              : failureText(r.error ? { code: r.error.code } : undefined),
        );
    } catch {
      if (!run.signal.aborted) fail(t('upload.readFailed'));
    } finally {
      if (abort === run) abort = undefined;
      busy = false;
      draw();
      o.changed();
    }
  };
  file.addEventListener('change', () => {
    // The first media server is where an upload goes: named while it is asked, before the engine says.
    offServers ??= watchList(env, 'media-servers', (rows) => {
      const first = rows.find((r) => r.kind === 'server');
      if (first?.kind === 'server') server = first.url;
    });
    const f = file.files?.[0];
    file.value = '';
    if (f) void send(f);
  });
  input.addEventListener('input', () => (status.replaceChildren(), draw()));
  draw();
  const el = h(
    'div',
    { class: `pefield peimage pe-${o.field}` },
    h('label', { class: 'pelabel', for: id }, t(o.label)),
    h('div', { class: 'perow' }, input, upload, remove, restore, file),
    status,
  );
  return {
    el,
    input,
    value: () => input.value,
    set: (v) => ((input.value = v), draw()),
    rebase(next) {
      saved = next;
      draw();
    },
    busy: () => busy,
    uploaded,
    enable(on) {
      enabled = on;
      draw();
    },
    dispose() {
      abort?.abort();
      offServers?.();
    },
  };
}
