import { installShell } from './engine/offline-shell.ts';
// lkjstr: the page. It starts from what is saved on this device (settings, layouts, the last account) and draws
// at once; the engine answers from its worker when it is ready.

import { watchAccountProfiles } from './engine/account-profiles.ts';
import { createEngine } from './engine/client.ts';
import type { EngineConfig } from './engine/protocol.ts';
import { createTransport } from './engine/startup.ts';
import { createIdleLock } from './shared/account-idle.ts';
import { rememberAccounts, rememberedAccounts, rememberFace } from './shared/face.ts';
import { resolveLang, setLang, t } from './shared/i18n.ts';
import { openIncomingLink } from './shared/incoming-link.ts';
import { pressedAt, watchPairs } from './shared/keys.ts';
import { layoutKey, spacesKey } from './shared/layout-store.ts';
import { migrateStorage } from './shared/migrate.ts';
import { learnPerson } from './shared/people.ts';
import { createSettings } from './shared/settings.ts';
import { kv } from './shared/storage.ts';
import { createTopBar } from './ui/topbar.ts';
import { backupPending } from './views/account-key.ts';
import { installEmojiPeek } from './views/emoji-peek.ts';
import { toast } from './views/parts.ts';
import { setServed } from './views/registry.ts';
import { createWmController, type Wm } from './wm/controller.ts';
import { createHost } from './wm/host.ts';
import { otherTabs } from './wm/other-tabs.ts';
import { FAMILY, familyOf, GUEST } from './wm/presets.ts';
import { retireSaved } from './wm/reset.ts';
import { parseActive, SPACES } from './wm/spaces.ts';
import { createSpacesBar } from './wm/spaces-bar.ts';
import { createWmStore } from './wm/store.ts';

watchPairs(window);
migrateStorage();
const cached = kv.get('account');
let settingsAccount = typeof cached === 'string' ? cached : '';
const settings = createSettings(settingsAccount);
let language = resolveLang(settings.get().language);
setLang(language);
document.documentElement.lang = language;

const engine = createEngine(await createTransport(__ENGINE_URL__));
const configure = (): void =>
  engine.configure({
    language,
    clientTag: settings.get().clientTag,
    clientTagAccount: settingsAccount || undefined,
    linkPreviews: settings.get().linkPreviews,
    heuristics: true,
    prefetch: true,
    mock: kv.get('mock') as EngineConfig['mock'],
  });
configure();
engine.info.subscribe((i) => setServed(i?.version ?? 0));
// The last account is remembered (its key, and its face and kind of signer) so the first frame already shows who
// is reading and asks for the first lists as that person, before the engine has spoken.
if (typeof cached === 'string')
  engine.accounts.set({
    accounts: rememberedAccounts(cached).map((a) => ({ ...a, author: learnPerson(a.author) })),
    active: cached,
  });
watchAccountProfiles(engine);
const stopIdleLock = createIdleLock(engine, settings);
window.addEventListener('pagehide', (event) => {
  if (!event.persisted) stopIdleLock();
});
engine.accounts.subscribe((a) => {
  if (a.active) kv.set('account', a.active);
  else kv.remove('account');
  rememberAccounts(a.accounts);
  rememberFace(a.accounts.find((x) => x.author.pubkey === a.active));
  const activeAccount = a.active ?? '';
  if (settingsAccount !== activeAccount) {
    settingsAccount = activeAccount;
    settings.setAccount(activeAccount);
  }
});

const host = createHost();
host.look(settings.get());
const store = createWmStore();
let ctl: Wm | undefined;
let shown = 0; // the workspace `ctl` shows
let picked: number | undefined; // this browser tab's workspace, once it chose one
let incoming: (() => void) | undefined; // opens the tab of an incoming link (until the engine has spoken)
let family = ''; // the layout family `ctl` shows: the reader's own, or the visitor's while signed out
const active = (): number => picked ?? parseActive(store.get(spacesKey(FAMILY)));
// This workspace goes back with Undo. Every layout: each workspace of both families first sends the tabs its default
// lacks to its own closed tabs, with what they held (this one through its controller); then the layouts are forgotten,
// but for any workspace whose closed tabs the device had no room to keep.
const resetLayouts = (every: boolean): void => {
  const here = ctl?.reset(!every) ?? true;
  if (!every) return;
  const kept = new Set(here ? [] : [layoutKey(family, shown)]);
  for (const f of [FAMILY, GUEST])
    for (let n = 1; n <= SPACES; n++)
      if ((f !== family || n !== shown) && !retireSaved(store.get(layoutKey(f, n)), f, n))
        kept.add(layoutKey(f, n));
  store.reset(kept);
  if (kept.size) toast(host.layer, t('set.resetLayoutsPartial'));
};
const env = { engine, settings, layer: host.layer, resetLayouts };
installEmojiPeek(host.layer);

function update(): void {
  const n = active();
  const f = familyOf(Boolean(engine.me()));
  if (ctl && (shown !== n || family !== f)) ctl.dispose(), (ctl = undefined);
  if (!ctl)
    ctl = createWmController(env, host, store.space((family = f), (shown = n)), f, {
      tabs: () => otherTabs(store, family, shown),
      show: (tab, workspace) => {
        if (workspace) {
          pick(workspace);
          ctl?.show(tab);
        }
      },
    });
  bar.show(n);
}
const pick = (n: number): void => {
  if (n === active()) return;
  picked = n;
  store.save(spacesKey(FAMILY), { active: n });
  update();
};
const bar = createSpacesBar(pick);
const top = createTopBar(host.bar, {
  engine,
  settings,
  spaces: bar.el,
  search: () => ctl?.search(),
  layer: host.layer,
  open: (kind, state) =>
    (kind === 'account' || kind === 'messages') && !state
      ? ctl?.go(kind)
      : kind === 'compose' && !state
        ? ctl?.compose()
        : ctl?.open(kind, state),
});
update();
// Signing in brings the reader's own layout, signing out the visitor's. A key that still has to be saved keeps
// its tab through the change.
engine.accounts.subscribe(() => {
  const arrive = incoming; // the engine's first word: a link that came in goes where the reader ends up
  incoming = undefined;
  if (familyOf(Boolean(engine.me())) === family) return;
  // The visitor's layout is left as it was read in: the tab that signed in has done its work.
  if (engine.me()) ctl?.drop('account');
  update();
  if (backupPending()) ctl?.open('account');
  arrive?.();
});

let taggedAccount = settingsAccount;
let tagged = settings.get().clientTag;
let previews = settings.get().linkPreviews;
settings.subscribe((s) => {
  host.look(s);
  const next = resolveLang(s.language);
  const reconfigure =
    previews !== s.linkPreviews || s.clientTag !== tagged || settingsAccount !== taggedAccount;
  previews = s.linkPreviews;
  tagged = s.clientTag;
  taggedAccount = settingsAccount;
  if (next === language) {
    if (reconfigure) configure();
    return;
  }
  // Another language: every label is drawn again.
  language = next;
  setLang(next);
  document.documentElement.lang = next;
  configure();
  ctl?.dispose();
  ctl = undefined;
  update();
  top.render();
});

window.addEventListener(
  'keydown',
  (e) => {
    const at = pressedAt(e, 'workspace');
    if (at >= 0) e.preventDefault(), pick(at + 1);
  },
  true,
);

void openIncomingLink(
  engine,
  (kind, ref) => (incoming = () => ctl?.open(kind, { ref }))(),
  (text) => toast(host.layer, text),
);

if (__REAL_ENGINE__)
  installShell(
    () =>
      engine.posting?.get() ||
      Array.from(document.querySelectorAll<HTMLTextAreaElement>('textarea.ctext')).some(
        (field) => field.value.length > 0,
      ) ||
      document.querySelector('.compose .thumb, .compose .cctx') !== null,
    () => toast(host.layer, t('shell.updateReady')),
  );
