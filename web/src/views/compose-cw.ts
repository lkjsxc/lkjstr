// The composer's content warning: a button in its bar (indigo while on) and, while on, a one-line reason over the
// text, drawn dashed like the cover readers will see. The note goes out with the warning ('' when no reason is given).
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { icon } from '../shared/icons.ts';

export type Warning = {
  readonly button: HTMLElement;
  readonly field: HTMLInputElement;
  /** Shows what a draft carries: on with its reason, or off (`undefined`). */
  set(cw: string | undefined): void;
};

export function createWarning(state: { cw?: string }, save: () => void, back: () => void): Warning {
  const field = h('input', {
    type: 'text',
    class: 'ccw',
    maxlength: 200,
    placeholder: t('compose.cwReason'),
    'aria-label': t('compose.cwReason'),
  }) as HTMLInputElement;
  const button = h(
    'button',
    { class: 'icon', title: t('compose.cw'), 'aria-label': t('compose.cw') },
    icon('warn'),
  );
  const set = (cw: string | undefined): void => {
    state.cw = cw;
    field.hidden = cw === undefined;
    if (field.value !== (cw ?? '')) field.value = cw ?? '';
    button.classList.toggle('on', cw !== undefined);
    button.setAttribute('aria-pressed', String(cw !== undefined));
  };
  button.addEventListener('click', () => {
    const on = state.cw === undefined;
    set(on ? '' : undefined);
    save();
    if (on) field.focus({ preventScroll: true });
    else back();
  });
  field.addEventListener('input', () => ((state.cw = field.value), save()));
  set(state.cw);
  return { button, field, set };
}
