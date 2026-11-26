// Where the reading place is on the rail when the row at the top has no position yet: rows the engine has not counted
// (older history just loaded, or live notes, while the index rebuilds). The nearest counted row in list order stands
// in, older rows first, so the grip stays beside the reader instead of falling to the top. Pure and tested.
export function nearPlace<P>(
  rows: readonly { readonly key: string }[],
  key: string | undefined,
  at: (key: string) => P | undefined,
): P | undefined {
  if (key === undefined) return;
  const own = at(key);
  if (own) return own;
  const i = rows.findIndex((r) => r.key === key);
  if (i < 0) return;
  for (let d = 1; d < rows.length; d++) {
    const older = rows[i + d];
    const found = (older && at(older.key)) || (i - d >= 0 ? at(rows[i - d]?.key ?? '') : undefined);
    if (found) return found;
    if (i + d >= rows.length && i - d < 0) return;
  }
}
