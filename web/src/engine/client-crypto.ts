// NIP-07 transport only. The Worker validates envelope signatures and private room membership.
import type { FromEngine, ToEngine } from './protocol.ts';

type Cipher = {
  encrypt?(peer: string, text: string): Promise<string>;
  decrypt?(peer: string, text: string): Promise<string>;
};
type Extension = { getPublicKey?(): Promise<string>; nip44?: Cipher; nip04?: Cipher };
export async function answerCrypt(
  msg: Extract<FromEngine, { t: 'crypt' }>,
  post: (message: ToEngine) => void,
  current: () => boolean = () => true,
): Promise<void> {
  if (!current()) return;
  const ext = (window as { nostr?: Extension }).nostr;
  if (!ext?.getPublicKey) return post({ t: 'crypted', req: msg.req, error: 'signer-missing' });
  const method =
    msg.operation === 'nip44.encrypt'
      ? ext.nip44?.encrypt
      : msg.operation === 'nip44.decrypt'
        ? ext.nip44?.decrypt
        : ext.nip04?.decrypt;
  if (!method) return post({ t: 'crypted', req: msg.req, error: 'unsupported' });
  try {
    const owner = await ext.getPublicKey();
    if (!current()) return;
    if (owner !== msg.pubkey) throw new Error('wrong account');
    const cipher = msg.operation.startsWith('nip44.') ? ext.nip44 : ext.nip04;
    const value = await method.call(cipher, msg.peer, msg.data);
    if (!current()) return;
    const confirmed = await ext.getPublicKey();
    if (!current()) return;
    if (confirmed !== msg.pubkey) throw new Error('account changed');
    if (typeof value !== 'string' || value.length > 1_400_000) throw new Error('invalid answer');
    post({ t: 'crypted', req: msg.req, value });
  } catch {
    if (current()) post({ t: 'crypted', req: msg.req, error: 'signer-refused' });
  }
}

export async function answerPublicKey(
  req: string,
  post: (message: ToEngine) => void,
): Promise<void> {
  const ext = (window as { nostr?: Extension }).nostr;
  if (!ext?.getPublicKey) return post({ t: 'publicKey', req, error: 'signer-missing' });
  try {
    post({ t: 'publicKey', req, pubkey: String(await ext.getPublicKey()) });
  } catch {
    post({ t: 'publicKey', req, error: 'signer-refused' });
  }
}

type Nip07 = { signEvent(event: unknown): Promise<unknown>; getPublicKey?(): Promise<unknown> };

export async function answerSign(
  msg: Extract<FromEngine, { t: 'sign' }>,
  post: (message: ToEngine) => void,
  wantsSign: (req: string | undefined) => boolean,
): Promise<void> {
  if (!wantsSign(msg.actionReq)) {
    post({ t: 'signed', req: msg.req, error: 'signer-refused' });
    return;
  }
  const ext = (window as { nostr?: Nip07 }).nostr;
  try {
    if (!ext) throw new Error('no signer extension');
    const event = JSON.stringify(await ext.signEvent(JSON.parse(msg.event)));
    if (!wantsSign(msg.actionReq)) return;
    post({ t: 'signed', req: msg.req, event });
  } catch (e) {
    if (!wantsSign(msg.actionReq)) return;
    post({ t: 'signed', req: msg.req, error: String((e as Error).message ?? e) });
  }
}
