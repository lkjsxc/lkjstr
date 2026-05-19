import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { npubEncode, nsecEncode } from 'nostr-tools/nip19';
import { npubMatchesPrefix, type NpubMinerEvent } from './npub-miner';

type Command =
  | { readonly type: 'start'; readonly prefix: string }
  | { readonly type: 'cancel' };

let running = false;

self.onmessage = (message: MessageEvent<Command>) => {
  if (message.data.type === 'cancel') running = false;
  if (message.data.type === 'start' && !running) void mine(message.data.prefix);
};

async function mine(prefix: string): Promise<void> {
  running = true;
  const startedAt = Date.now();
  let attempts = 0;
  while (running) {
    for (let index = 0; index < 512; index += 1) {
      const secret = generateSecretKey();
      const pubkey = getPublicKey(secret);
      const npub = npubEncode(pubkey);
      attempts += 1;
      if (!npubMatchesPrefix(npub, prefix)) continue;
      running = false;
      post({
        type: 'result',
        result: progress(startedAt, attempts, {
          pubkey,
          npub,
          nsec: nsecEncode(secret),
        }),
      });
      return;
    }
    post({ type: 'progress', progress: progress(startedAt, attempts) });
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function progress<T extends object>(
  startedAt: number,
  attempts: number,
  extra?: T,
): { attempts: number; rate: number; elapsedMs: number } & T {
  const elapsedMs = Math.max(Date.now() - startedAt, 1);
  return {
    attempts,
    rate: Math.round((attempts * 1000) / elapsedMs),
    elapsedMs,
    ...extra,
  } as { attempts: number; rate: number; elapsedMs: number } & T;
}

function post(event: NpubMinerEvent): void {
  self.postMessage(event);
}
