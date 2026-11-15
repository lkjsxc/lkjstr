//! Bootstrap belongs to the frontend; a verified active-account NIP-65 list wins.
use super::*;
use lkjstr_core::engine::wire::RelayConfig;
impl Host {
    pub(super) fn bootstrap(&mut self, relays: Vec<RelayConfig>) {
        if relays.len() > 8 {
            return;
        }
        let relays = relays
            .into_iter()
            .map(|mut r| {
                r.url = lkjstr_core::engine::settings::strict_relay(&r.url)?;
                Some(r)
            })
            .collect::<Option<Vec<_>>>();
        let Some(relays) = relays else {
            return;
        };
        self.bootstrap_relays = relays;
        // Replaying another tab must preserve learned read/write usage, while
        // still accepting the frontend's current independent search settings.
        self.apply_relay_owner(true);
    }
    pub(super) fn apply_relay_owner(&mut self, force: bool) {
        let learned = self.accounts.active.as_ref().and_then(|account| {
            self.engine
                .account_relays(account)
                .map(|(id, entries)| ((account.clone(), id), entries))
        });
        let owner = learned.as_ref().map(|(owner, _)| owner.clone());
        if !force && owner == self.relay_owner {
            return;
        }
        let entries = if let Some((_, mut entries)) = learned {
            for search in self.bootstrap_relays.iter().filter(|r| r.search) {
                if let Some(entry) = entries.iter_mut().find(|r| r.url == search.url) {
                    entry.search = true;
                } else if entries.len() < 8 {
                    entries.push(RelayConfig {
                        url: search.url.clone(),
                        read: false,
                        write: false,
                        search: true,
                    });
                }
            }
            entries
        } else {
            self.bootstrap_relays.clone()
        };
        let at = self.time();
        if self.engine.configure_relays(entries, at).is_ok() {
            self.relay_owner = owner;
        }
    }
}
