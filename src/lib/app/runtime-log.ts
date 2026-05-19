import { appendAppLog, boundedMessage } from '../log/app-log';

export function logRuntimeError(code: string): (error: unknown) => void {
  return (error) =>
    void appendAppLog({
      area: 'runtime',
      severity: 'error',
      code,
      message: boundedMessage(error),
    });
}
