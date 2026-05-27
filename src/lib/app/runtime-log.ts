import { appendAppLog, boundedMessage } from '../log/app-log';

export type StartupPromiseFailure = {
  readonly code: string;
  readonly surface: string;
  readonly kind?: string;
  readonly tabId?: string;
  readonly owner?: string;
  readonly relayCount?: number;
};

export function logRuntimeError(code: string): (error: unknown) => void {
  return (error) =>
    void appendAppLog({
      area: 'runtime',
      severity: 'error',
      code,
      message: boundedMessage(error),
    });
}

export function captureStartupPromise(
  promise: Promise<unknown>,
  input: StartupPromiseFailure,
): void {
  void promise.catch(logStartupPromiseFailure(input));
}

export function logStartupPromiseFailure(
  input: StartupPromiseFailure,
): (error: unknown) => void {
  return (error) =>
    void appendAppLog({
      area: 'runtime',
      severity: 'error',
      code: input.code,
      message: boundedMessage(error),
      context: compactStartupContext(input),
    });
}

function compactStartupContext(
  input: StartupPromiseFailure,
): Readonly<Record<string, unknown>> {
  return Object.fromEntries(
    Object.entries(input).filter(
      ([key, value]) => key !== 'code' && value !== undefined,
    ),
  );
}
