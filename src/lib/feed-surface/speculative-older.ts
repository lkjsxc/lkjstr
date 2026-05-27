export type OlderRequestCoordinator = {
  readonly requestFromNearEnd: () => Promise<void>;
  readonly reset: () => void;
};

export function createOlderRequestCoordinator(
  loadOlder: () => Promise<void>,
  canLoadMore: () => boolean,
  options: { readonly speculative: boolean } = { speculative: true },
): OlderRequestCoordinator {
  let busy = false;
  let speculativeUsed = false;

  const requestFromNearEnd = async (): Promise<void> => {
    if (busy || !canLoadMore()) return;
    busy = true;
    try {
      await loadOlder();
      if (options.speculative && !speculativeUsed && canLoadMore()) {
        speculativeUsed = true;
        await loadOlder();
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
