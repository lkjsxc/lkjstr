//! Bootstrap belongs to the frontend; a verified active-account NIP-65 list wins.
use super::*;
use lkjstr_core::engine::wire::RelayConfig;
impl Host {
    pub(super) fn save_visitor_relays(
        &mut self,
        req: String,
        relays: Vec<lkjstr_core::engine::wire::actions::RelayEntry>,
    ) -> lkjstr_core::engine::wire::Output {
        use lkjstr_core::engine::wire::{Output, Session};
        let entries = relays
            .into_iter()
            .map(|r| {
                Some(RelayConfig {
                    url: lkjstr_core::engine::settings::strict_relay(&r.url)?,
                    read: r.read,
                    write: r.write,
                    search: self
                        .bootstrap_relays
                        .iter()
                        .any(|old| old.url == r.url && old.search),
                })
            })
            .collect::<Option<Vec<_>>>();
        match entries {
            Some(entries) if entries.len() <= 64 => {
                self.bootstrap(
                    entries
                        .into_iter()
                        .filter(|r| r.read || r.write || r.search)
                        .collect(),
                );
                Output::Result {
                    req,
                    ok: true,
                    error: None,
                    delivery: None,
                    id: None,
                    uploaded: None,
                    key: None,
                    encrypted_key: None,
                    zap_intent: None,
                    dm_draft: None,
                    dm_draft_revision: None,
                    dm_delivery: None,
                    client_info: None,
                    cancelled: None,
                }
            }
            _ => Session::failure(req, "rejected"),
        }
    }
    pub(super) fn bootstrap(&mut self, relays: Vec<RelayConfig>) {
        if relays.len() > 64 {
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
        let at = self.time();
        self.engine.discover_accounts(
            self.accounts
                .entries
                .iter()
                .filter(|_| !self.sessions.is_empty())
                .map(|a| a.pubkey.clone())
                .collect(),
            self.bootstrap_relays
                .iter()
                .map(|r| r.url.clone())
                .chain(self.accounts.entries.iter().flat_map(|a| {
                    a.relay_hints.iter().cloned().chain(
                        self.engine
                            .account_relays(&a.pubkey)
                            .into_iter()
                            .flat_map(|(_, relays)| relays.into_iter())
                            .filter(|r| r.read || r.write)
                            .map(|r| r.url),
                    )
                }))
                .collect(),
            at,
        );
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
                } else if entries.len() < 64 {
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
