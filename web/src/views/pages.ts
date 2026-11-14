// Two plain tabs. Shortcuts: the key table itself (`shared/keys.ts`), so it lists exactly the keys that work.
// About: what this is, which engine answers, and where its source, licence and privacy policy are.
import { h, replaceChildren } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { groupText, KEY_GROUPS, KEYS, type KeyId, keyCaps, keyText } from '../shared/keys.ts';
import type { ViewEnv } from './registry.ts';

export const SOURCE_URL = 'https://github.com/lkjsxc/lkjstr';

export function mountShortcuts(el: HTMLElement): () => void {
  const ids = Object.keys(KEYS) as KeyId[];
  el.classList.add('pad');
  el.replaceChildren(
    ...KEY_GROUPS.flatMap((group) => [
      h('h3', { class: 'sgroup' }, t(groupText(group))),
      h(
        'dl',
        { class: 'keys' },
        ids
          .filter((id) => KEYS[id].group === group)
          .map((id) => [
            h(
              'dt',
              null,
              keyCaps(id).map((cap) => h('kbd', null, cap)),
            ),
            h('dd', null, t(keyText(id))),
          ]),
      ),
    ]),
  );
  return () => undefined;
}

export function mountAbout(el: HTMLElement, env: ViewEnv): () => void {
  const engine = h('dd');
  const link = (href: string, text: string): HTMLElement =>
    h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, text);
  const show = (): void => {
    const info = env.engine.info.get();
    replaceChildren(
      engine,
      info ? t('about.engineIs', { name: info.engine, n: info.version }) : t('about.engineWait'),
    );
  };
  el.classList.add('pad');
  el.replaceChildren(
    h('p', { class: 'aname' }, h('b', null, 'lkjstr'), ` ${__VERSION__}`),
    h('p', { class: 'muted' }, t('about.what')),
    h(
      'dl',
      { class: 'facts' },
      h('dt', null, t('about.version')),
      h('dd', null, `${__VERSION__} (${__COMMIT__})`),
      h('dt', null, t('about.engine')),
      engine,
      h('dt', null, t('about.source')),
      h('dd', null, link(SOURCE_URL, SOURCE_URL.replace('https://', ''))),
      h('dt', null, t('about.licence')),
      h('dd', null, link('/LICENSE.txt', 'Apache License 2.0')),
      h('dt', null, t('about.privacy')),
      h('dd', null, link('/privacy.html', t('about.privacyLink'))),
    ),
  );
  show();
  return env.engine.info.subscribe(show);
}
