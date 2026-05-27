export type OlderRequestCoordinator<T = void> = {
  readonly requestFromNearEnd: (context?: T) => Promise<void>;
  readonly reset: () => void;
};

export function createOlderRequestCoordinator<T = void>(
  loadOlder: (context?: T) => Promise<void>,
  canLoadMore: () => boolean,
  options: { readonly speculative: boolean } = { speculative: true },
): OlderRequestCoordinator<T> {
  let busy = false;
  let speculativeUsed = false;

  const requestFromNearEnd = async (context?: T): Promise<void> => {
    if (busy || !canLoadMore()) return;
    busy = true;
    try {
      await loadOlder(context);
      if (options.speculative && !speculativeUsed && canLoadMore()) {
        speculativeUsed = true;
        await loadOlder(context);
      }
    } finally {
      busy = false;
    }
  };

  return {
    requestFromNearEnd,
    reset: () => {
      busy = false;
      speculativeUsed = false;
    },
  };
}
