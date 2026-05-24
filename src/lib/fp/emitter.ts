export type Emitter<T> = {
  readonly emit: (value: T) => void;
  readonly listen: (listener: (value: T) => void) => () => void;
  readonly clear: () => void;
};

export function createEmitter<T>(): Emitter<T> {
  const listeners = new Set<(value: T) => void>();
  return {
    emit: (value) => listeners.forEach((listener) => listener(value)),
    listen: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    clear: () => listeners.clear(),
  };
}
