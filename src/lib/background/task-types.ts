export type BackgroundTaskPriority =
  | 'user-visible'
  | 'near-visible'
  | 'maintenance'
  | 'idle';

export type BackgroundTaskEventType =
  | 'queued'
  | 'started'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'dropped'
  | 'rejected'
  | 'replaced';

export type BackgroundTaskEvent = {
  readonly type: BackgroundTaskEventType;
  readonly taskId: string;
  readonly owner: string;
  readonly priority: BackgroundTaskPriority;
  readonly at: number;
  readonly reason?: string;
};

export type BackgroundTaskScope = {
  readonly signal: AbortSignal;
  readonly checkpoint: () => Promise<void>;
  readonly report: (event: BackgroundTaskEvent) => void;
};

export type BackgroundTask = {
  readonly id: string;
  readonly owner: string;
  readonly priority: BackgroundTaskPriority;
  readonly run: (scope: BackgroundTaskScope) => Promise<void>;
};

export type BackgroundTaskSnapshot = {
  readonly queued: number;
  readonly active: number;
  readonly completed: number;
  readonly failed: number;
  readonly cancelled: number;
  readonly dropped: number;
  readonly rejected: number;
  readonly oldestQueuedAgeMs: number;
  readonly events: readonly BackgroundTaskEvent[];
};

export type BackgroundTaskHandle = {
  readonly enqueue: (task: BackgroundTask) => boolean;
  readonly cancelOwner: (owner: string, reason?: string) => void;
  readonly snapshot: () => BackgroundTaskSnapshot;
  readonly close: () => void;
};
