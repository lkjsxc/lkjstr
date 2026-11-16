//! Only advertised DM inboxes receive wrappers; ordinary NIP-65 outboxes are never a fallback.
use super::*;
use crate::engine::{
    protocol::{Query as EngineQuery, Source},
    publication_plan::Destination,
};
use crate::store::Store;
use lkjstr_protocol::{NostrEvent, NostrFilter};
pub type Want = (String, NostrFilter, EngineQuery);
pub fn nips_event(event: &NostrEvent) -> Result<Event, &'static str> {
    serde_json::from_value(serde_json::to_value(event).map_err(|_| "internal")?)
        .map_err(|_| "rejected")
}
pub fn inboxes(store: &Store, account: &str) -> Result<Vec<String>, &'static str> {
    let event = store.replaceable(account, 10050).ok_or("not-found")?;
    let event = nips_event(&event)?;
    let relays = dm::inbox_relays(Some(&event), account).map_err(|_| "rejected")?;
    if relays.len() > 8 {
        return Err("too-large");
    }
    Ok(relays)
}
pub fn destinations(store: &Store, recipient: &str) -> Result<Vec<Destination>, &'static str> {
    Ok(inboxes(store, recipient)?
        .into_iter()
        .map(|url| Destination {
            url,
            rule: "inbox".into(),
            state: "pending".into(),
            reason: None,
        })
        .collect())
}
pub fn advertisement(
    account: &str,
    relays: &[String],
    now: u64,
) -> Result<lkjstr_protocol::UnsignedNostrEvent, &'static str> {
    if !lkjstr_protocol::is_pubkey(account) || relays.is_empty() || relays.len() > 8 {
        return Err("rejected");
    }
    let mut seen = BTreeSet::new();
    for url in relays {
        seen.insert(crate::engine::settings::strict_relay(url).ok_or("rejected")?);
    }
    Ok(lkjstr_protocol::UnsignedNostrEvent {
        pubkey: account.into(),
        created_at: now,
        kind: 10050,
        tags: seen.into_iter().map(|r| vec!["relay".into(), r]).collect(),
        content: String::new(),
    })
}
pub fn inbox_filter(account: &str, until: Option<u64>) -> NostrFilter {
    NostrFilter {
        kinds: Some(vec![1059]),
        tags: BTreeMap::from([("p".into(), vec![account.into()])]),
        until,
        limit: Some(200),
        ..Default::default()
    }
}
pub fn discovery(account: &str) -> NostrFilter {
    NostrFilter {
        authors: Some(vec![account.into()]),
        kinds: Some(vec![10050]),
        limit: Some(1),
        ..Default::default()
    }
}
pub fn wants(
    store: &Store,
    accounts: &BTreeSet<String>,
    pending: &BTreeSet<String>,
    cursors: &BTreeMap<(String, String), u64>,
) -> Vec<Want> {
    let mut wants = Vec::new();
    for account in accounts.union(pending) {
        wants.push((
            format!("~dm-list:{account}"),
            discovery(account),
            EngineQuery::default(),
        ));
    }
    for account in accounts {
        if let Ok(relays) = inboxes(store, account) {
            for relay in relays {
                let query = EngineQuery {
                    source: Source::Relay,
                    account: Some(account.clone()),
                    target: Some(relay.clone()),
                    filters: crate::engine::protocol::Filters {
                        relay_hints: vec![relay.clone()],
                        ..Default::default()
                    },
                };
                wants.push((
                    format!("~dm:{account}"),
                    inbox_filter(account, None),
                    query.clone(),
                ));
                if let Some(until) = cursors.get(&(account.clone(), relay)) {
                    wants.push((
                        format!("~dm:{account}"),
                        inbox_filter(account, Some(*until)),
                        query,
                    ));
                }
            }
        }
        // Legacy archives use ordinary read routes, without publishing or rewriting.
        for filter in [
            NostrFilter {
                kinds: Some(vec![4]),
                authors: Some(vec![account.clone()]),
                limit: Some(200),
                ..Default::default()
            },
            NostrFilter {
                kinds: Some(vec![4]),
                tags: BTreeMap::from([("p".into(), vec![account.clone()])]),
                limit: Some(200),
                ..Default::default()
            },
        ] {
            let query = EngineQuery {
                account: Some(account.clone()),
                ..Default::default()
            };
            wants.push((
                format!("~dm-legacy:{account}"),
                filter.clone(),
                query.clone(),
            ));
            if let Some(until) = cursors.get(&(account.clone(), "legacy".into())) {
                let mut history = filter;
                history.until = Some(*until);
                wants.push((format!("~dm-legacy:{account}"), history, query));
            }
        }
    }
    wants
}
