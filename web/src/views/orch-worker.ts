// The worker band: the verification slice, ingress against its cap, the tick, queues and the store.
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { NONE, num, type OrchStats, put } from './orch-model.ts';
import { bytesText } from './stats.ts';

/** Engine caps are binary (32 MiB, 64 MiB): drawn as such so they read as the round numbers they are. */
const mib = (n: number): string =>
  n < 104_858 ? bytesText(n) : `${num(Math.round((n / 1048576) * 10) / 10)} MiB`;
const of = (n: number | undefined, fmt: (n: number) => string = num): string =>
  n === undefined ? NONE : fmt(n);

export function createWorker() {
  const cells = h('div', { class: 'oslice', 'aria-hidden': 'true' });
  const sliceText = h('span', { class: 'onum' });
  const fill = h('span');
  const ingress = h(
    'div',
    { class: 'ometer', 'aria-hidden': 'true' },
    fill,
    h('i', { style: 'left:50%' }),
    h('i', { style: 'left:90%' }),
  );
  const ingressText = h('span', { class: 'onum' });
  const facts = h('div', { class: 'ofacts' });
  const node = h(
    'section',
    { class: 'oband oworker', 'aria-label': t('orch.worker') },
    h('div', { class: 'ohead' }, t('orch.worker')),
    h(
      'div',
      { class: 'ometers' },
      h('div', { class: 'ogauge' }, cells, sliceText),
      h('div', { class: 'ogauge' }, ingress, ingressText),
    ),
    facts,
  );
  return {
    node,
    draw(s: OrchStats): void {
      const w = s.worker;
      node.hidden = !w;
      if (!w) return;
      const max = w.sliceLimit;
      const done = w.lastSliceVerified;
      cells.parentElement!.hidden = done === undefined;
      if (done !== undefined) {
        while (cells.children.length < max) cells.append(h('span'));
        while (cells.children.length > max) cells.lastElementChild!.remove();
        [...cells.children].forEach((c, i) => c.classList.toggle('on', i < done));
        put(sliceText, t('orch.slice', { n: num(done), max: num(max) }));
      }
      const share = w.verifyIngressCapBytes ? w.verifyIngressBytes / w.verifyIngressCapBytes : 0;
      fill.style.width = `${Math.min(100, Math.round(share * 100))}%`;
      ingressText.classList.toggle('high', share >= 0.9);
      put(
        ingressText,
        t('orch.ingress', {
          v: mib(w.verifyIngressBytes),
          cap: mib(w.verifyIngressCapBytes),
        }),
      );
      const fact = (text: string, cls = ''): HTMLElement =>
        h('span', { class: `ofact ${cls}` }, text);
      const count = (label: string, n: number | undefined, cls = ''): HTMLElement =>
        fact(`${label} ${of(n)}`, `${cls}${n ? '' : ' nil'}`);
      facts.replaceChildren(
        fact(t('orch.tick', { ms: num(w.lastTickMs), max: num(w.maxTickMs) })),
        fact(t('orch.persistQueue', { n: num(w.persistenceQueueLen) })),
        fact(t('orch.kept', { n: num(w.regularStored), cap: of(w.regularCap) })),
        fact(t('orch.keptReplaceable', { n: num(w.replaceableStored), cap: of(w.replaceableCap) })),
        fact(t('orch.payload', { v: of(w.payloadBytes, mib), cap: mib(w.memoryCapBytes) })),
        count(t('orch.rejected'), w.rejectedTotal),
        // Dropped matters most here: its own slot, never hidden, even at zero.
        count(t('orch.dropped'), w.droppedTotal, 'odrop'),
        ...(w.storeEvictions === undefined ? [] : [count(t('orch.evictions'), w.storeEvictions)]),
        ...(w.ghostHits === undefined ? [] : [count(t('orch.ghostHits'), w.ghostHits)]),
      );
    },
  };
}
