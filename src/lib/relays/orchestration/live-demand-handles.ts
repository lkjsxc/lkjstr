export type LiveDemandHandles = ReturnType<typeof createLiveDemandHandles>;

export function createLiveDemandHandles() {
  const releases = new Map<string, () => void>();

  const release = (channel: string): void => {
    const current = releases.get(channel);
    if (!current) return;
    releases.delete(channel);
    current();
  };

  return {
    replace: (channel: string, next: () => void): void => {
      release(channel);
      releases.set(channel, next);
    },
    release,
    releaseAll: (): void => {
      for (const channel of [...releases.keys()]) release(channel);
    },
    has: (channel: string): boolean => releases.has(channel),
  };
}
