export function unixNow(): number {
  return Math.floor(Date.now() / 1000);
}

export function isUnixSecond(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
