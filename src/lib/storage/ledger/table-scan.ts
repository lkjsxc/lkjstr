export type StorageRowSource<T> = {
  readonly each: (visit: (row: T) => void) => Promise<void>;
};

export async function visitStorageRows<T>(
  source: StorageRowSource<T>,
  visit: (row: T) => Promise<void>,
): Promise<boolean> {
  let visits = Promise.resolve();
  try {
    await source.each((row) => {
      visits = visits.then(() => visit(row));
    });
  } catch {
    return false;
  }
  await visits;
  return true;
}
