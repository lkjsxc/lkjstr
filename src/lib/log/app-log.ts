export type AppLogArea =
  | 'runtime'
  | 'relay'
  | 'storage'
  | 'signer'
  | 'cache'
  | 'subscription';

export type AppLogSeverity = 'info' | 'warn' | 'error';

export type AppLogRecord = {
  readonly id: string;
  readonly timestamp: number;
  readonly area: AppLogArea;
  readonly severity: AppLogSeverity;
  readonly code: string;
  readonly message: string;
  readonly context?: Readonly<Record<string, unknown>>;
};

type Listener = (records: readonly AppLogRecord[]) => void;

const maxRecords = 300;
let records: AppLogRecord[] = [];
const listeners = new Set<Listener>();

export function appendAppLog(
  input: Omit<AppLogRecord, 'id' | 'timestamp'> & {
    readonly timestamp?: number;
  },
): AppLogRecord | undefined {
  if (isSuppressedSesNoise(input)) return undefined;
  const record: AppLogRecord = {
    ...input,
    id: crypto.randomUUID(),
    timestamp: input.timestamp ?? Date.now(),
    context: redactContext(input.context),
  };
  records = [...records.slice(-(maxRecords - 1)), record];
  emit();
  return record;
}

export function appLogRecords(): readonly AppLogRecord[] {
  return records;
}

export function subscribeAppLog(listener: Listener): () => void {
  listeners.add(listener);
  listener(records);
  return () => listeners.delete(listener);
}

export function clearAppLogForTests(): void {
  records = [];
  emit();
}

export function startGlobalLogCapture(): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const onError = (event: ErrorEvent) => {
    appendAppLog({
      area: 'runtime',
      severity: 'error',
      code: 'window-error',
      message: boundedMessage(event.message || event.error),
      context: { filename: event.filename, lineno: event.lineno },
    });
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    appendAppLog({
      area: 'runtime',
      severity: 'error',
      code: 'unhandled-rejection',
      message: boundedMessage(event.reason),
    });
  };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}

export function boundedMessage(value: unknown): string {
  const text =
    value instanceof Error ? value.message : String(value ?? 'unknown error');
  return text.length > 240 ? `${text.slice(0, 237)}...` : text;
}

function emit(): void {
  listeners.forEach((listener) => listener(records));
}

function redactContext(
  context: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | undefined {
  if (!context) return undefined;
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [
      key,
      /secret|nsec|sig|draft|payload/i.test(key) ? '[redacted]' : value,
    ]),
  );
}

function isSuppressedSesNoise(input: {
  readonly code: string;
  readonly message: string;
  readonly context?: Readonly<Record<string, unknown>>;
}): boolean {
  return (
    input.code === 'SES_UNCAUGHT_EXCEPTION' &&
    input.message === 'null' &&
    String(input.context?.filename ?? '').includes('lockdown-install.js')
  );
}
