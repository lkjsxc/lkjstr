use super::{
    Engine,
    publication_plan::{Destination, PublicationInput},
    settings::strict_relay,
    wire::{RelayConfig, WriteRelayList},
};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Default)]
pub(super) struct NoteRoutes {
    // One record per locally known owner, at most 32; each route list has at most 64 entries.
    accounts: BTreeMap<String, (Option<Vec<RelayConfig>>, Option<WriteRelayList>)>,
    defaults: Vec<String>,
}

pub(super) struct NoteRoutePolicy {
    pub(super) list: Option<WriteRelayList>,
    pub(super) blocked: BTreeSet<String>,
}
impl NoteRoutePolicy {
    pub(super) fn allows(&self, url: &str) -> bool {
        strict_relay(url).is_some_and(|url| !self.blocked.contains(&url))
    }
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
                    && list.urls.len() + list.read_only.len() <= 64
                    && list
                        .urls
                        .iter()
                        .chain(&list.read_only)
                        .all(|url| strict_relay(url).as_ref() == Some(url))
            });
            accounts.insert(
                account,
                (
                    configured.map(|rs| {
                        rs.into_iter()
                            .take(64)
                            .filter_map(|mut r| {
                                r.url = strict_relay(&r.url)?;
                                Some(r)
                            })
                            .collect()
                    }),
                    cached,
                ),
            );
        }
    }

    pub fn write_relay_list(&self, account: &str) -> Option<WriteRelayList> {
        let record = self.store.replaceable(account, 10002)?;
        let (_, entries) = self.account_relays(account)?;
        let (writes, reads): (Vec<_>, Vec<_>) = entries.into_iter().partition(|r| r.write);
        Some(WriteRelayList {
            id: record.id.clone(),
            at: record.created_at,
            urls: writes.into_iter().map(|relay| relay.url).collect(),
            read_only: reads.into_iter().map(|relay| relay.url).collect(),
        })
    }

    pub(super) fn note_route_policy(&self, account: &str) -> NoteRoutePolicy {
        let local = self.note_routes.accounts.get(account);
        let resolved = self.write_relay_list(account);
        let cached = local.and_then(|(_, cache)| cache.as_ref());
        let list = match (resolved, cached) {
            (Some(live), Some(cached)) if !cached.is_newer_than(&live) => Some(live),
            (Some(live), None) => Some(live),
            (_, cached) => cached.cloned(),
        };
        let configured = local
            .and_then(|(entries, _)| entries.as_ref())
            .into_iter()
            .flatten();
        let mut blocked: BTreeSet<_> = configured
            .filter(|r| !r.write)
            .map(|r| r.url.clone())
            .collect();
        if local.is_none() {
            blocked.extend(
                self.network
                    .known
                    .values()
                    .filter(|r| !r.write && (r.read || r.search))
                    .map(|r| r.url.clone()),
            );
        }
        if let Some(list) = &list {
            blocked.extend(list.read_only.iter().cloned());
        } else if let Some((_, entries)) = self.account_relays(account) {
            blocked.extend(entries.into_iter().filter(|r| !r.write).map(|r| r.url));
        }
        NoteRoutePolicy { list, blocked }
    }

    pub(super) fn note_write_routes(
        &self,
        account: &str,
        input: &mut PublicationInput,
        policy: &NoteRoutePolicy,
    ) -> Vec<String> {
        let local = self.note_routes.accounts.get(account);
        let configured = local.and_then(|(entries, _)| entries.as_ref());
        if let Some(list) = policy.list.as_ref().filter(|list| !list.urls.is_empty()) {
            input.own.clone_from(&list.urls);
        } else if local.is_some()
            && (policy.list.is_some() || self.account_relays(account).is_none())
        {
            input.own = configured
                .into_iter()
                .flatten()
                .filter(|r| r.write)
                .map(|r| r.url.clone())
                .collect();
        }
        input.own.retain(|url| policy.allows(url));
        let needs_writers = input.own.is_empty();
        input.own.extend(
            configured
                .into_iter()
                .flatten()
                .filter(|r| {
                    r.write
                        && policy.allows(&r.url)
                        && (needs_writers
                            || self
                                .network
                                .relays
                                .get(&r.url)
                                .is_some_and(|relay| relay.online))
                })
                .map(|r| r.url.clone()),
        );
        if input.own.is_empty() {
            input.own.extend(
                self.note_routes
                    .defaults
                    .iter()
                    .filter(|url| policy.allows(url))
                    .cloned(),
            );
            if policy.list.is_none() {
                return input.own.clone();
            }
        }
        input.own.sort_by_key(|url| {
            !self
                .network
                .relays
                .get(url)
                .is_some_and(|relay| relay.online)
        });
        Vec::new()
    }
}

pub(super) fn refreshed_destinations(
    list: &WriteRelayList,
    policy: &NoteRoutePolicy,
) -> Vec<Destination> {
    super::publication_plan::plan_note(PublicationInput {
        own: list
            .urls
            .iter()
            .filter(|url| policy.allows(url))
            .cloned()
            .collect(),
        ..Default::default()
    })
}

#[cfg(test)]
#[path = "note_routes_test.rs"]
mod tests;
