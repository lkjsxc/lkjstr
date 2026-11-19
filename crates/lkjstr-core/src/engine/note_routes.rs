use super::{
    Engine,
    publication_plan::{Destination, PublicationInput},
    settings::strict_relay,
    wire::{RelayConfig, WriteRelayList},
};
use std::collections::BTreeMap;

#[derive(Default)]
pub(super) struct NoteRoutes {
    // One record per locally known owner, at most 32; each route list has at most 64 entries.
    accounts: BTreeMap<String, (Option<Vec<RelayConfig>>, Option<WriteRelayList>)>,
    defaults: Vec<String>,
}

impl Engine {
    pub fn configure_note_routes(
        &mut self,
        account: Option<String>,
        configured: Option<Vec<RelayConfig>>,
        cached: Option<WriteRelayList>,
        defaults: Option<Vec<String>>,
    ) {
        if let Some(defaults) = defaults {
            self.note_routes.defaults = defaults
                .iter()
                .filter_map(|url| strict_relay(url))
                .take(12)
                .collect();
        }
        let Some(account) = account.filter(|id| lkjstr_protocol::is_pubkey(id)) else {
            return;
        };
        let accounts = &mut self.note_routes.accounts;
        if accounts.len() < 32 || accounts.contains_key(&account) {
            let cached = cached.filter(|list| {
                lkjstr_protocol::is_event_id(&list.id)
                    && list.urls.len() <= 64
                    && list
                        .urls
                        .iter()
                        .all(|url| strict_relay(url).as_ref() == Some(url))
            });
            accounts.insert(
                account,
                (
                    configured.map(|rs| rs.into_iter().take(64).collect()),
                    cached,
                ),
            );
        }
    }

    pub fn write_relay_list(&self, account: &str) -> Option<WriteRelayList> {
        let record = self.store.replaceable(account, 10002)?;
        let (_, entries) = self.account_relays(account)?;
        Some(WriteRelayList {
            id: record.id.clone(),
            at: record.created_at,
            urls: entries
                .into_iter()
                .filter(|relay| relay.write)
                .map(|relay| relay.url)
                .collect(),
        })
    }

    pub(super) fn note_write_routes(
        &self,
        account: &str,
        input: &mut PublicationInput,
    ) -> (Option<String>, Vec<String>) {
        let local = self.note_routes.accounts.get(account);
        let (configured, cached) = local
            .map(|(entries, cached)| (entries.as_ref(), cached.as_ref()))
            .unwrap_or_default();
        let resolved = self.write_relay_list(account);
        let list = match (&resolved, cached) {
            (Some(live), Some(cached)) if cached.is_newer_than(live) => Some(cached),
            (Some(live), _) => Some(live),
            (_, cached) => cached,
        };
        if let Some(list) = list.filter(|list| !list.urls.is_empty()) {
            input.own.clone_from(&list.urls);
        } else if local.is_some() && (list.is_some() || self.account_relays(account).is_none()) {
            input.own = configured
                .into_iter()
                .flatten()
                .filter(|r| r.write)
                .map(|r| r.url.clone())
                .collect();
        }
        let eligible = self
            .account_relays(account)
            .map(|(_, entries)| entries)
            .or_else(|| configured.cloned());
        if let Some(eligible) = eligible {
            input.own.extend(
                eligible
                    .iter()
                    .filter(|r| {
                        (r.read || r.write)
                            && self
                                .network
                                .relays
                                .get(&r.url)
                                .is_some_and(|socket| socket.online)
                    })
                    .map(|r| r.url.clone()),
            );
        }
        let defaults = if input.own.is_empty() {
            input.own.clone_from(&self.note_routes.defaults);
            self.note_routes.defaults.clone()
        } else {
            Vec::new()
        };
        if let Some(list) = list {
            (Some(list.id.clone()), Vec::new())
        } else {
            (None, defaults)
        }
    }

    pub(super) fn refreshed_note_routes(
        &self,
        account: &str,
        previous: Option<&str>,
    ) -> Option<WriteRelayList> {
        let list = self.write_relay_list(account)?;
        if Some(list.id.as_str()) == previous {
            return None;
        }
        let cached = self
            .note_routes
            .accounts
            .get(account)
            .and_then(|(_, list)| list.as_ref());
        if cached.is_some_and(|cached| cached.is_newer_than(&list)) {
            return None;
        }
        Some(list)
    }
}

pub(super) fn refreshed_destinations(list: &WriteRelayList) -> Vec<Destination> {
    super::publication_plan::plan(PublicationInput {
        own: list.urls.clone(),
        ..Default::default()
    })
}
