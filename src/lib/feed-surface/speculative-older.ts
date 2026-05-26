export type OlderRequestCoordinator = {
  readonly requestFromNearEnd: () => Promise<void>;
  readonly reset: () => void;
};

export function createOlderRequestCoordinator(
  loadOlder: () => Promise<void>,
  canLoadMore: () => boolean,
): OlderRequestCoordinator {
  let busy = false;
  let speculativeUsed = false;

  const requestFromNearEnd = async (): Promise<void> => {
    if (busy || !canLoadMore()) return;
    busy = true;
    try {
      await loadOlder();
      if (!speculativeUsed && canLoadMore()) {
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
