// NIP-07 transport only. The Worker validates signatures and private room membership.

import { type ExtensionWait, waitForInjection } from './extension-wait.ts';
import type { FromEngine } from './protocol.ts';
import type { ExtensionCall } from './signer-orchestrator.ts';

type Cipher = {
  encrypt?(peer: string, text: string): Promise<string>;
  decrypt?(peer: string, text: string): Promise<string>;
};
export type Extension = {
  getPublicKey?(): Promise<string>;
  signEvent?(event: unknown): Promise<unknown>;
  nip44?: Cipher;
  nip04?: Cipher;
};
const extension = (): Extension | undefined => (window as { nostr?: Extension }).nostr ?? undefined;
export const findExtension = (wait: ExtensionWait): Promise<Extension> =>
  waitForInjection(extension, wait);
export function extensionAvailable(): boolean {
  const ext = extension();
  return typeof ext?.signEvent === 'function' && typeof ext.getPublicKey === 'function';
}

const invoke = async <T>(method: () => Promise<T>): Promise<T> => {
  try {
    return await method();
  } catch {
    throw new Error('signer-refused');
  }
};

export async function cryptWithExtension(
  msg: Extract<FromEngine, { t: 'crypt' }>,
  call: ExtensionCall,
  ext: Extension,
): Promise<string> {
  const getPublicKey = ext?.getPublicKey;
  if (!ext || !getPublicKey) throw new Error('signer-missing');
  const cipher = msg.operation.startsWith('nip44.') ? ext.nip44 : ext.nip04;
  const method = msg.operation === 'nip44.encrypt' ? cipher?.encrypt : cipher?.decrypt;
  if (!method) throw new Error('unsupported');
  const owner = await call(() => invoke(() => getPublicKey.call(ext)));
  if (owner !== msg.pubkey) throw new Error('signer-refused');
  const value = await call(() => invoke(() => method.call(cipher, msg.peer, msg.data)));
  // NIP-07 has no account-change notification or account-bound cipher API. A signer can
  // change its active key between calls (including while another queued job runs).
  // Keep both identity checks; a page/account cache cannot replace either safely.
  const confirmed = await call(() => invoke(() => getPublicKey.call(ext)));
  if (confirmed !== msg.pubkey || typeof value !== 'string' || value.length > 1_400_000)
    throw new Error('signer-refused');
  return value;
}

export async function extensionPublicKey(call: ExtensionCall, ext: Extension): Promise<string> {
  const method = ext?.getPublicKey;
  if (!method) throw new Error('signer-missing');
  return String(await call(() => invoke(() => method.call(ext))));
}

export async function extensionSign(
  msg: Extract<FromEngine, { t: 'sign' }>,
  call: ExtensionCall,
  ext: Extension,
): Promise<string> {
  const method = ext?.signEvent;
  if (typeof method !== 'function') throw new Error('signer-missing');
  const event: unknown = JSON.parse(msg.event);
  const signed = JSON.stringify(await call(() => invoke(() => method.call(ext, event))));
  if (typeof signed !== 'string') throw new Error('signer-refused');
  return signed;
}
