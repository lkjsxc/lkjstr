// A failed attachment keeps its File for retry; buffers are freshly read before transfer.
import type { Uploaded } from '../engine/protocol.ts';
import { hostOf } from '../shared/address.ts';
import { h, replaceChildren } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';
import { SERVER_CHOICES } from '../shared/media-servers.ts';
import { failureText } from './can.ts';
import { watchList } from './lists.ts';
import type { ViewEnv } from './registry.ts';

type Item = { file: File; el: HTMLElement; busy: boolean; done?: Uploaded; removed?: boolean };
const READ_MS = 10_000;
export function createAttachments(env: ViewEnv, changed: () => void) {
  const el = h('div', { class: 'thumbs' });
  const limit = h('div', { class: 'error', role: 'status' });
  let items: Item[] = []; // at most eight files in this draft, each at most 20 MiB
  let servers = [...SERVER_CHOICES];
  let disposed = false;
  const off = watchList(env, 'media-servers', (rows, loaded) => {
    if (loaded)
      servers = [
        ...new Set([
          ...rows.flatMap((r) => (r.kind === 'server' ? [r.url] : [])),
          ...SERVER_CHOICES,
        ]),
      ];
  });
  const run = async (item: Item, server?: string): Promise<void> => {
    if (item.busy || item.removed) return;
    const account = env.engine.me();
    let target = server ?? servers[0] ?? t('upload.server');
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
          items = items.filter((x) => x !== item);
          item.el.remove();
          changed();
        },
      },
      '×',
    );
    replaceChildren(
      item.el,
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
        if (result.uploaded.type === 'image')
          item.el.prepend(h('img', { src: result.uploaded.url, alt: item.file.name }));
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
        ...servers.map((url) => h('option', { value: url }, hostOf(url))),
      );
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
      for (const file of files) {
        if (items.length >= 8) {
          limit.textContent = t('upload.limit');
          el.append(limit);
          break;
        }
        limit.remove();
        const item: Item = { file, el: h('div', { class: 'thumb' }), busy: false };
        items.push(item);
        el.append(item.el);
        void run(item);
      }
    },
    blocked: (): boolean => items.some((i) => !i.done),
    media: (): Uploaded[] => items.flatMap((i) => (i.done ? [i.done] : [])),
    clear(): void {
      for (const i of items) i.removed = true;
      items = [];
      el.replaceChildren();
    },
    dispose(): void {
      disposed = true;
      off();
    },
  };
}
