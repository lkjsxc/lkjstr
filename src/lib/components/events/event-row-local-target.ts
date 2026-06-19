const rowLocalSelector =
  'button,a,input,textarea,select,form,.event-action-zone';

type ClosestTarget = {
  closest?: (selector: string) => unknown;
  parentElement?: ClosestTarget | null;
};

export function eventRowTargetIsLocal(target: EventTarget | null): boolean {
  const candidate = target as ClosestTarget | null;
  const elementTarget =
    candidate?.closest && typeof candidate.closest === 'function'
      ? candidate
      : (candidate?.parentElement ?? null);

  return Boolean(
    elementTarget?.closest &&
    typeof elementTarget.closest === 'function' &&
    elementTarget.closest(rowLocalSelector),
  );
}
