// Explicit slow-note fixtures exercise the same main-thread signer transport as the real engine.
import type { Draft, Failure, ToEngine } from '../protocol.ts';
import type { Core } from './engine.ts';
import { byPubkey } from './people.ts';

export function createMockExtensionNotes(
  core: Core,
  fail: (req: string, code: Failure['code']) => void,
) {
  const pending = new Map<string, () => void>(); // bound: at most 64 client actions
  return {
    discover(req: string): void {
      core.post({ t: 'getPublicKey', req, expiresAt: core.now() + 60_000 });
    },
    ask(req: string, pubkey: string, text: string, complete: () => void): void {
      if (pending.size >= 64) return fail(req, 'too-large');
      pending.set(req, complete);
      core.post({
        t: 'sign',
        req,
        pubkey,
        event: JSON.stringify({ pubkey, content: text, kind: 1, tags: [], created_at: 1 }),
        expiresAt: core.now() + 60_000,
        weight: 16,
      });
    },
    signed(message: Extract<ToEngine, { t: 'signed' }>): void {
      const complete = pending.get(message.req);
      if (!complete) return;
      pending.delete(message.req);
      if (message.event && !message.error) complete();
      else
        fail(
          message.req,
          message.error === 'cancelled'
            ? 'cancelled'
            : message.error === 'signer-missing'
              ? 'signer-missing'
              : 'signer-refused',
        );
    },
    dispose(other: () => void) {
      pending.clear();
      other();
    },
  };
}

export function expandMentions(draft: Draft): string {
  let text = draft.text;
  for (const mention of [...(draft.mentions ?? [])].sort((a, b) => b.start - a.start)) {
    const author = byPubkey(mention.pubkey)?.author;
    if (author && text.slice(mention.start, mention.end) === mention.label)
      text = `${text.slice(0, mention.start)}nostr:${author.npub}${text.slice(mention.end)}`;
  }
  return text;
}
