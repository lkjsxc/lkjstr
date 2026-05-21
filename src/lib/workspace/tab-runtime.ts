export type TabMetadata = {
  readonly title: string;
  readonly icon: string;
  readonly avatarUrl?: string | null;
  readonly dirty?: boolean;
  readonly loading?: boolean;
};

export type TabRuntime<TState = unknown> = {
  readonly key: string;
  readonly state: TState;
  readonly metadata: () => TabMetadata;
  readonly suspend: () => void;
  readonly resume: () => void;
  readonly close: () => void;
};

export function createBasicRuntime<TState>(
  key: string,
  state: TState,
  metadata: TabMetadata,
): TabRuntime<TState> {
  let closed = false;
  let suspended = false;
  return {
    key,
    state,
    metadata: () => ({
      ...metadata,
      loading: metadata.loading && !suspended && !closed,
    }),
    suspend: () => {
      suspended = true;
    },
    resume: () => {
      if (!closed) suspended = false;
    },
    close: () => {
      closed = true;
      suspended = true;
    },
  };
}
