export type ResourceScope = {
  readonly add: (cleanup: () => void) => () => void;
  readonly close: () => void;
};

export function createResourceScope(): ResourceScope {
  const cleanups = new Set<() => void>();
  return {
    add: (cleanup) => {
      cleanups.add(cleanup);
      return () => cleanups.delete(cleanup);
    },
    close: () => {
      for (const cleanup of [...cleanups]) cleanup();
      cleanups.clear();
    },
  };
}
