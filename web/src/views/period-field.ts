import { parseDateInput } from '../shared/date-input.ts';
import { h } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';

/** Commit on leaving or Enter. An unreadable value never changes the last good filter. */
export function periodField(
  edge: 'start' | 'end',
  label: Key,
  value: string | undefined,
  commit: (value: string | undefined) => void,
  raw?: string,
  draft?: (raw: string) => void,
): HTMLElement {
  const hint = h('div', { class: 'date-hint error', hidden: true }, t('filter.dateUnreadable'));
  const field = h('input', {
    type: 'text',
    size: 10,
    value: raw ?? (value ?? '').replaceAll('-', '/'),
    placeholder: 'yyyy/mm/dd',
    'aria-label': t(label),
    title: t(label),
  });
  const accept = (): void => {
    const next = field.value.trim() ? parseDateInput(field.value, edge) : undefined;
    const invalid = !!field.value.trim() && next === undefined;
    hint.hidden = !invalid;
    field.setAttribute('aria-invalid', String(invalid));
    if (invalid) return;
    field.value = (next ?? '').replaceAll('-', '/');
    commit(next);
  };
  field.addEventListener('input', () => draft?.(field.value));
  field.addEventListener('blur', accept);
  if (raw && !parseDateInput(raw, edge)) {
    hint.hidden = false;
    field.setAttribute('aria-invalid', 'true');
  }
  field.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) e.preventDefault(), field.blur();
  });
  return h('div', { class: 'date-field' }, field, hint);
}
