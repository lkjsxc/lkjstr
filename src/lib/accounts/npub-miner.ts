export type NpubMineProgress = {
  readonly attempts: number;
  readonly rate: number;
  readonly elapsedMs: number;
};

export type NpubMineResult = NpubMineProgress & {
  readonly pubkey: string;
  readonly npub: string;
  readonly nsec: string;
};

export type NpubMinerEvent =
  | { readonly type: 'progress'; readonly progress: NpubMineProgress }
  | { readonly type: 'result'; readonly result: NpubMineResult }
  | { readonly type: 'error'; readonly message: string };

const bech32Chars = '023456789acdefghjklmnpqrstuvwxyz';

export function parseNpubPrefix(
  input: string,
):
  | { readonly ok: true; readonly prefix: string }
  | { readonly ok: false; readonly message: string } {
  const prefix = input
    .trim()
    .toLowerCase()
    .replace(/^npub1/, '');
  if (!prefix) return { ok: false, message: 'Enter a prefix after npub1.' };
  if (prefix.length > 8)
    return { ok: false, message: 'Use 8 characters or fewer for CPU mining.' };
  if ([...prefix].some((char) => !bech32Chars.includes(char)))
    return { ok: false, message: 'Use valid npub characters only.' };
  return { ok: true, prefix };
}

export function npubMatchesPrefix(npub: string, prefix: string): boolean {
  return npub.toLowerCase().startsWith(`npub1${prefix.toLowerCase()}`);
}

export function estimatedAttempts(prefix: string): number {
  return Math.pow(bech32Chars.length, prefix.length);
}

export function createNpubMiner(
  prefix: string,
  listener: (event: NpubMinerEvent) => void,
): { readonly cancel: () => void } {
  let terminal = false;
  const worker = new Worker(
    new URL('./npub-miner.worker.ts', import.meta.url),
    {
      type: 'module',
    },
  );
  const finish = (event: NpubMinerEvent): void => {
    if (terminal) return;
    listener(event);
    if (event.type === 'progress') return;
    terminal = true;
    worker.terminate();
  };
  worker.onmessage = (message: MessageEvent<NpubMinerEvent>) =>
    finish(message.data);
  worker.onerror = () =>
    finish({ type: 'error', message: 'Npub mining worker failed.' });
  worker.postMessage({ type: 'start', prefix });
  return {
    cancel: () => {
      if (terminal) return;
      terminal = true;
      worker.postMessage({ type: 'cancel' });
      worker.terminate();
    },
  };
}
