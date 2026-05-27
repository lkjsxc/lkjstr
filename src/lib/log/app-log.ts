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
type AppLogInput = Omit<AppLogRecord, 'id' | 'timestamp'> & {
  readonly timestamp?: number;
};

const maxRecords = 300;
let records: AppLogRecord[] = [];
const listeners = new Set<Listener>();

export function appendAppLog(input: AppLogInput): AppLogRecord | undefined {
  if (isSuppressedRuntimeNoise(input)) return undefined;
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

export function appLogCount(): number {
  return records.length;
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
    appendAppLog(appLogInputFromErrorEvent(event));
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    appendAppLog(appLogInputFromPromiseRejection(event));
  };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}

export function appLogInputFromErrorEvent(event: ErrorEvent): AppLogInput {
  const isSes = event.message === 'SES_UNCAUGHT_EXCEPTION';
  const message = isSes
    ? boundedRawMessage(event.error)
    : boundedMessage(event.message || event.error);
  return {
    area: 'runtime',
    severity: 'error',
    code: isSes ? 'SES_UNCAUGHT_EXCEPTION' : 'window-error',
    message,
    context: compactContext({
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      ...errorDetails(event.error),
    }),
  };
}

export function appLogInputFromPromiseRejection(
  event: PromiseRejectionEvent,
): AppLogInput {
  return {
    area: 'runtime',
    severity: 'error',
    code: 'unhandled-rejection',
    message: boundedMessage(event.reason),
    context: compactContext(errorDetails(event.reason)),
  };
}

export function boundedMessage(value: unknown): string {
  const text =
    value instanceof Error ? value.message : String(value ?? 'unknown error');
  return text.length > 240 ? `${text.slice(0, 237)}...` : text;
}

function boundedRawMessage(value: unknown): string {
  const text = value instanceof Error ? value.message : String(value);
  return text.length > 240 ? `${text.slice(0, 237)}...` : text;
}

function compactContext(
  context: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> | undefined {
  const compacted = Object.fromEntries(
    Object.entries(context).filter(
      ([, value]) => value !== undefined && value !== '',
    ),
  );
  return Object.keys(compacted).length > 0 ? compacted : undefined;
}

function errorDetails(value: unknown): Readonly<Record<string, unknown>> {
  if (value instanceof Error)
    return { errorName: value.name, errorMessage: boundedMessage(value) };
  return {};
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

function isSuppressedRuntimeNoise(input: {
  readonly code: string;
  readonly message: string;
  readonly context?: Readonly<Record<string, unknown>>;
}): boolean {
  if (
    input.code === 'window-error' &&
    input.message ===
      'ResizeObserver loop completed with undelivered notifications.'
  )
    return true;
  return (
    input.code === 'SES_UNCAUGHT_EXCEPTION' &&
    input.message === 'null' &&
    isExternalLockdownInstall(String(input.context?.filename ?? ''))
  );
}

function isExternalLockdownInstall(filename: string): boolean {
  if (!filename.includes('lockdown-install.js')) return false;
  const location = typeof window === 'undefined' ? undefined : window.location;
  try {
    const url = new URL(filename, location?.href);
    if (
      location?.origin &&
      (url.protocol === 'http:' || url.protocol === 'https:')
    )
      return url.origin !== location.origin;
    return url.protocol !== 'http:' && url.protocol !== 'https:';
  } catch {
    return !filename.startsWith('/');
  }
}
