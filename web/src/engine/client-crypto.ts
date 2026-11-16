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
): Promise<void> {
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
    if ((await ext.getPublicKey()) !== msg.pubkey) throw new Error('wrong account');
    const cipher = msg.operation.startsWith('nip44.') ? ext.nip44 : ext.nip04;
    const value = await method.call(cipher, msg.peer, msg.data);
    if ((await ext.getPublicKey()) !== msg.pubkey) throw new Error('account changed');
    if (typeof value !== 'string' || value.length > 1_400_000) throw new Error('invalid answer');
    post({ t: 'crypted', req: msg.req, value });
  } catch {
    post({ t: 'crypted', req: msg.req, error: 'signer-refused' });
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
