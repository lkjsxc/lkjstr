// One send as the reader sees it, the same in the composer's draft, its status line and Home. Sent needs one relay's
// accepting OK for this exact note, and is said at once; the other relays go on answering quietly. A deadline with no
// acceptance is never Sent. Only a signer that waits on the reader (extension, remote) is named, after ten seconds.
import type { Account, Delivery, Failure } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';
import { failureText } from './can.ts';

export type SendPhase = 'signing' | 'sending' | 'sent' | 'unconfirmed' | 'refused' | 'failed';
/** A signer the reader may have to answer. */
export type Asking = 'extension' | 'remote';

export const asking = (signer: Account['signer'] | undefined): Asking | undefined =>
  signer === 'extension' || signer === 'remote' ? signer : undefined;

/** `busy`: the engine has not answered the action yet. */
export function sendPhase(
  busy: boolean,
  signed: string | undefined,
  relays: readonly Delivery[] = [],
): SendPhase {
  if (busy) return signed || relays.length ? 'sending' : 'signing';
  if (relays.some((r) => r.state === 'ok')) return 'sent';
  if (relays.some((r) => r.state === 'pending' || r.state === 'timeout')) return 'unconfirmed';
  return relays.length ? 'refused' : 'failed';
}

export const waitKey = (who: Asking | undefined): Key | undefined =>
  who === 'remote'
    ? 'account.busy.remote'
    : who === 'extension'
      ? 'account.busy.extension'
      : undefined;

/** The one line a send says, in the draft and in the composer's status. */
export function sendWords(
  phase: SendPhase,
  relays: readonly Delivery[] = [],
  error?: Failure,
  wait?: Key,
): string {
  const counts = { ok: relays.filter((r) => r.state === 'ok').length, all: relays.length };
  // Before the signature nothing has left the browser: 'posting', not 'sending' (owner, 2026-11-26).
  if (phase === 'signing') return t(wait ?? 'compose.posting');
  if (phase === 'sending')
    return relays.length ? t('compose.sending', counts) : t('compose.pending');
  if (phase === 'sent') return t('compose.sent', counts);
  if (phase === 'unconfirmed') return t('compose.unconfirmed');
  if (phase === 'refused') return t('compose.refused');
  return error ? failureText(error) : t('compose.retained');
}

export const sendClass = (phase: SendPhase): string =>
  phase === 'refused' || phase === 'failed' ? 'error' : 'muted';

const LINES = 5;
/** Relays that refused (in their words) or did not answer, at most five; relays still answering stay quiet. */
export function relayLines(relays: readonly Delivery[]): HTMLElement[] {
  const shown = [
    ...relays.filter((r) => r.state === 'failed'),
    ...relays.filter((r) => r.state === 'timeout'),
  ];
  const lines = shown
    .slice(0, LINES)
    .map((r) =>
      h(
        'div',
        { class: 'muted', 'data-relay': r.url, 'data-state': r.state },
        `${r.url.replace(/^wss:\/\//, '')}: ${r.state === 'failed' ? r.message || t('error.rejected') : t('compose.noAnswer')}`,
      ),
    );
  if (shown.length > LINES)
    lines.push(h('div', { class: 'muted' }, t('compose.more', { n: shown.length - LINES })));
  return lines;
}

/** The composer's status for its latest send. `ms`: from Post to this line saying Sent, for the checks. */
export function sendLine(
  relays: readonly Delivery[],
  final: boolean,
  id?: string,
  ms?: number,
): HTMLElement[] {
  const phase = sendPhase(!final, id, relays);
  const ok = relays.filter((r) => r.state === 'ok').length;
  return [
    h(
      'div',
      {
        class: `csend${phase === 'refused' ? ' error' : ''}`,
        'data-phase': phase,
        'data-event': id ?? null,
        'data-ok': String(ok),
        'data-all': String(relays.length),
        'data-ms': phase === 'sent' && ms !== undefined ? String(Math.round(ms)) : null,
      },
      sendWords(phase, relays),
    ),
    ...relayLines(relays),
  ];
}
