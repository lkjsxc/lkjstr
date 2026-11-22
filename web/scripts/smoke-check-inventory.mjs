// Check identities are independent of how the concurrent lanes interleave.
export function createCheckInventory(expectedNames) {
  const expected = new Set();
  for (const name of expectedNames) {
    if (expected.has(name)) throw new Error(`Duplicate name in smoke inventory: ${name}`);
    expected.add(name);
  }
  const seen = new Map();

  return {
    record(name) {
      seen.set(name, (seen.get(name) ?? 0) + 1);
    },
    requireComplete() {
      const missing = [...expected].filter((name) => !seen.has(name));
      const extra = [...seen.keys()].filter((name) => !expected.has(name));
      const duplicates = [...seen].filter(([, count]) => count > 1);
      if (missing.length || extra.length || duplicates.length) {
        throw new Error(
          `Smoke check inventory mismatch: ${JSON.stringify({ missing, extra, duplicates })}`,
        );
      }
      return seen.size;
    },
  };
}
