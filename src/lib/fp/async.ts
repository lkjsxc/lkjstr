export async function mapAsyncBounded<T, U>(
  values: readonly T[],
  limit: number,
  fn: (value: T, index: number) => Promise<U>,
): Promise<U[]> {
  const results = new Array<U>(values.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < values.length) {
      const index = next;
      next += 1;
      results[index] = await fn(values[index]!, index);
    }
  };
  const count = Math.max(1, Math.min(limit, values.length));
  await Promise.all(Array.from({ length: count }, worker));
  return results;
}
