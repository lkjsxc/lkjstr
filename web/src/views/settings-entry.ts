// One entry of the Settings list: "Group: Title", a description and a control. Built once, then synced in place,
// so typing in the search box or in a control is never interrupted by a repaint.
import { h } from '../shared/h.ts';
import { both, type Key, t } from '../shared/i18n.ts';
import {
  DEFAULT_SETTINGS,
  type SettingField,
  type Settings,
  type SettingsStore,
} from '../shared/settings.ts';

export type Entry = {
  readonly group: string;
  /** Lower-case text the search matches. */
  readonly text: string;
  readonly node: HTMLElement;
  /** Shows the stored value, leaving the focused control alone; returns whether it differs from the default. */
  sync(s: Settings, focused: Element | null): boolean;
};

type Control = { readonly input: HTMLElement; set(value: unknown): void };

function control(f: SettingField, save: (v: unknown) => void): Control {
  if (f.type === 'bool') {
    const input = h('input', { type: 'checkbox', onchange: () => save(input.checked) });
    return { input, set: (v) => void (input.checked = v === true) };
  }
  if (f.type === 'number') {
    const step = f.step ?? 1;
    const input = h('input', {
      type: 'number',
      min: f.min,
      max: f.max,
      step,
      onchange: () => {
        if (!input.value.trim()) return;
        const n = Number((Math.round(Number(input.value) / step) * step).toFixed(4));
        if (n >= f.min && n <= f.max) save(n);
      },
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing) input.dispatchEvent(new Event('change'));
    });
    return { input, set: (v) => void (input.value = step < 1 ? Number(v).toFixed(2) : String(v)) };
  }
  const input = h(
    'select',
    { onchange: () => save(input.value) },
    f.options.map((o) => h('option', { value: o }, t(`opt.${o}` as Key))),
  );
  return { input, set: (v) => void (input.value = String(v)) };
}

/** The shell every entry shares; `extra` sits at the right of the title line. */
export function frame(
  group: string,
  title: string,
  extra: HTMLElement | null,
  ...body: HTMLElement[]
): HTMLElement {
  return h(
    'div',
    { class: 'sitem' },
    h(
      'div',
      { class: 'stitle' },
      h('span', { class: 'muted' }, `${group}:`),
      h('b', null, title),
      extra,
    ),
    ...body,
  );
}

export const searchText = (...parts: string[]): string => parts.join(' ').toLowerCase();

export function fieldEntry(f: SettingField, store: SettingsStore): Entry {
  const save = (v: unknown): void => store.patch({ [f.key]: v } as Partial<Settings>);
  const name = `set.${f.key}` as Key;
  const desc = `set.${f.key}.d` as Key;
  const [group = '', title = ''] = t(name).split(': ');
  const c = control(f, save);
  const reset = h(
    'button',
    {
      class: 'sreset',
      title: t('settings.resetHint'),
      onclick: () => save(DEFAULT_SETTINGS[f.key]),
    },
    t('settings.reset'),
  );
  const node =
    f.type === 'bool'
      ? frame(
          group,
          title,
          reset,
          h('label', { class: 'scheck' }, c.input, h('span', null, t(desc))),
        )
      : frame(group, title, reset, h('div', { class: 'muted' }, t(desc)), c.input);
  node.dataset.entry = f.key;
  c.input.setAttribute('aria-label', title);
  return {
    group,
    text: searchText(both(name), both(desc), f.key),
    node,
    sync(s, focused) {
      const changed = s[f.key] !== DEFAULT_SETTINGS[f.key];
      node.classList.toggle('changed', changed);
      reset.hidden = !changed;
      if (focused !== c.input) c.set(s[f.key]);
      return changed;
    },
  };
}
