// A failed attachment keeps its File for retry; buffers are freshly read before transfer. A picture shows from the
// moment it is chosen (from the file itself while it uploads); pressed, it opens full size in a media tab, like a
// picture in a note, with the draft's other pictures beside it (owner, 2026-11-26).
import type { ServerRow, Uploaded } from '../engine/protocol.ts';
import { hostOf } from '../shared/address.ts';
import { h, replaceChildren } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';
import { SERVER_CHOICES } from '../shared/media-servers.ts';
import { failureText } from './can.ts';
import { draftPicture } from './compose-picture.ts';
import { watchList } from './lists.ts';
import type { ViewEnv } from './registry.ts';

export type AttachmentState = 'ready' | 'uploading' | 'failed';
type Item = {
  file: File;
  el: HTMLElement;
  busy: boolean;
  done?: Uploaded;
  removed?: boolean;
  abort?: AbortController;
  /** The chosen picture's own address on this device; let go when the item goes. */
  local?: string;
};
const READ_MS = 10_000;
export function createAttachments(
  env: ViewEnv,
  changed: (removed?: boolean) => void,
  el: HTMLElement = h('div', { class: 'thumbs' }),
) {
  const limit = h('div', { class: 'error', role: 'status' });
  let items: Item[] = []; // at most eight files in this draft, each at most 20 MiB
  let servers = [...SERVER_CHOICES];
  let verdicts: readonly ServerRow[] = [];
  const pickers = new Set<HTMLSelectElement>(); // at most eight failed attachments
  const serverLabel = (url: string): string => {
    const r = verdicts.find((v) => v.url === url);
    const status =
      r?.checked && !r.ok
        ? t('servers.down')
        : r?.protocol === 'nip96'
          ? 'NIP-96'
          : r?.protocol === 'blossom'
            ? 'Blossom'
            : t('servers.unconfirmed');
    return `${hostOf(url)} · ${status}`;
  };
  const drawOption = (option: HTMLOptionElement): void => {
    const row = verdicts.find((r) => r.url === option.value);
    option.textContent = serverLabel(option.value);
    option.className = row?.checked ? (row.ok ? '' : 'bad') : 'muted';
    option.title = row?.error ? failureText(row.error) : '';
  };
  let disposed = false;
  let off: (() => void) | undefined;
  const source = (i: Item): string | undefined =>
    i.done ? (i.done.type === 'image' ? i.done.url : undefined) : i.local;
  const forget = (i: Item): void => {
    if (i.local) URL.revokeObjectURL(i.local);
    i.local = undefined;
  };
  const picture = (item: Item, src: string): HTMLElement =>
    draftPicture(env, src, item.done?.alt, () => {
      const shown = items.filter((i) => source(i));
      return { urls: shown.map((i) => source(i) ?? ''), index: shown.indexOf(item) };
    });
  const watchServers = (): void => {
    off ??= watchList(env, 'media-servers', (rows, loaded) => {
      verdicts = rows.filter((r): r is ServerRow => r.kind === 'server');
      for (const pick of pickers) for (const option of pick.options) drawOption(option);
      if (loaded) servers = verdicts.map((r) => r.url);
    });
  };
  const run = async (item: Item, server?: string): Promise<void> => {
    if (item.busy || item.removed || disposed) return;
    const abort = new AbortController();
    item.abort = abort;
    const account = env.engine.me();
    let target = server ?? servers[0] ?? t('upload.server');
    for (const pick of pickers) if (!pick.isConnected) pickers.delete(pick);
    const previous = item.el.querySelector('select');
    if (previous) pickers.delete(previous);
    item.busy = true;
    item.el.className = 'thumb';
    const bar = h('i');
    const status = h(
      'span',
      { class: 'muted', role: 'status' },
      t('upload.discovering', { server: hostOf(target) }),
    );
    const remove = h(
      'button',
      {
        class: 'x',
        title: t('compose.drop'),
        'aria-label': t('compose.drop'),
        onclick: () => {
          item.removed = true;
          item.abort?.abort();
          forget(item);
          items = items.filter((x) => x !== item);
          const picker = item.el.querySelector('select');
          if (picker) pickers.delete(picker);
          item.el.remove();
          changed(true);
        },
      },
      '×',
    );
    replaceChildren(
      item.el,
      item.local ? picture(item, item.local) : null,
      h('span', { class: 'clip' }, item.file.name),
      h('span', { class: 'prog' }, bar),
      status,
      remove,
    );
    changed();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = <T>(work: Promise<T>, ms: number): Promise<T> =>
      Promise.race([
        work,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error('upload-timeout')), ms);
        }),
      ]).finally(() => clearTimeout(timer));
    let reading = true;
    try {
      if (item.file.size > 20 * 1024 * 1024) {
        showFailure(t('error.too-large'));
        return;
      }
      const bytes = await deadline(item.file.arrayBuffer(), READ_MS);
      if (disposed || item.removed) return;
      reading = false;
      const result = await env.engine.act(
        {
          a: 'upload',
          as: account,
          server,
          name: item.file.name,
          mime: item.file.type || 'application/octet-stream',
          bytes,
        },
        {
          uploadSignal: abort.signal,
          progress(sent, total, detail) {
            if (disposed || item.removed) return;
            target = detail?.server ?? target;
            bar.style.width = `${Math.round((sent / Math.max(total, 1)) * 100)}%`;
            status.textContent = t(`upload.${detail?.phase ?? 'uploading'}` as Key, {
              server: hostOf(target),
            });
          },
        },
      );
      if (disposed || item.removed) return;
      if (!result.ok || !result.uploaded) {
        const reported = result.error?.message;
        if (reported?.startsWith('https://') && URL.canParse(reported)) target = reported;
        showFailure(
          result.error?.code === 'not-found' && !result.error.message
            ? t('upload.noServer')
            : result.error?.code === 'signer-missing'
              ? t('upload.signerMissing')
              : failureText(result.error ? { code: result.error.code } : undefined),
        );
      } else {
        item.done = result.uploaded;
        item.el.classList.add('done');
        status.textContent = hostOf(target);
        if (result.uploaded.type === 'image' && !item.local) {
          item.local = URL.createObjectURL(item.file);
          item.el.prepend(picture(item, item.local));
        }
      }
    } catch (error) {
      showFailure(
        t(
          error instanceof Error && error.message === 'upload-timeout'
            ? 'error.upload-timeout'
            : reading
              ? 'upload.readFailed'
              : 'error.internal',
        ),
      );
    } finally {
      if (item.abort === abort) item.abort = undefined;
      item.busy = false;
      if (!disposed) changed();
    }
    function showFailure(reason: string): void {
      if (disposed || item.removed) return;
      item.el.classList.add('failed');
      status.className = 'error';
      status.textContent = target.startsWith('https://')
        ? t('upload.failed', { server: hostOf(target), reason })
        : reason;
      const pick = h(
        'select',
        { 'aria-label': t('upload.server') },
        ...servers.map((url) => h('option', { value: url }, serverLabel(url))),
      );
      pickers.add(pick);
      for (const option of pick.options) drawOption(option);
      if (target.startsWith('https://') && !servers.includes(target))
        pick.append(h('option', { value: target }, hostOf(target)));
      pick.value =
        servers.includes(target) || target.startsWith('https://') ? target : (servers[0] ?? '');
      item.el.append(
        pick,
        h(
          'button',
          { class: 'btn', onclick: () => void run(item, pick.value) },
          t('compose.retry'),
        ),
      );
    }
  };
  return {
    el,
    add(files: Iterable<File>): void {
      watchServers();
      for (const file of files) {
        if (items.length >= 8) {
          limit.textContent = t('upload.limit');
          el.append(limit);
          break;
        }
        limit.remove();
        const item: Item = { file, el: h('div', { class: 'thumb' }), busy: false };
        if (file.type.startsWith('image/')) item.local = URL.createObjectURL(file);
        items.push(item);
        el.append(item.el);
        void run(item);
      }
    },
    restore(media: readonly Uploaded[]): void {
      this.clear();
      for (const done of media.slice(0, 8)) {
        const item: Item = {
          file: new File([], done.url),
          done,
          busy: false,
          el: h('div', { class: 'thumb done' }),
        };
        if (done.type === 'image') item.el.append(picture(item, done.url));
        item.el.append(done.url);
        item.el.append(
          h(
            'button',
            {
              class: 'x',
              title: t('compose.drop'),
              'aria-label': t('compose.drop'),
              onclick: () => {
                item.removed = true;
                items = items.filter((i) => i !== item);
                item.el.remove();
                changed(true);
              },
            },
            '×',
          ),
        );
        items.push(item);
        el.append(item.el);
      }
      changed();
    },
    count: (): number => items.length,
    status: (): AttachmentState => {
      if (items.some((i) => !i.done && !i.busy)) return 'failed';
      return items.some((i) => i.busy) ? 'uploading' : 'ready';
    },
    media: (): Uploaded[] => items.flatMap((i) => (i.done ? [i.done] : [])),
    clear(): void {
      for (const i of items) {
        i.removed = true;
        i.abort?.abort();
        forget(i);
      }
      items = [];
      pickers.clear();
      el.replaceChildren();
    },
    dispose(): void {
      disposed = true;
      for (const i of items) {
        i.abort?.abort();
        forget(i);
      }
      off?.();
      pickers.clear();
    },
  };
}
