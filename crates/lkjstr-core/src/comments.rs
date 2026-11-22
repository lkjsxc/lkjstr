//! NIP-22 public comment relationships, distinct from generic event references.
//! Only validated lowercase parent tags are considered, never arbitrary e/q tags.
use crate::store::Store;
use lkjstr_nips::address::Coordinate;
use lkjstr_protocol::{NostrEvent, is_event_id};

fn value<'a>(event: &'a NostrEvent, name: &str) -> Option<&'a str> {
    event
        .tags
        .iter()
        .find(|t| t.first().is_some_and(|s| s == name))
        .and_then(|t| t.get(1))
        .map(String::as_str)
}
fn resolve(store: &Store, event: &NostrEvent, prefix: &str) -> Option<String> {
    let kind = value(event, if prefix == "root" { "K" } else { "k" })?;
    let (event_key, address_key) = if prefix == "root" {
        ("E", "A")
    } else {
        ("e", "a")
    };
    if let Some(id) = value(event, event_key).filter(|id| is_event_id(id)) {
        if let Some(target) = store.get(id) {
            return (target.kind.to_string() == kind).then(|| id.to_owned());
        }
        // An absent parent can still be linked by its declared public kind.
        return kind
            .parse()
            .ok()
            .filter(|k| crate::kinds::policy(*k).openable)
            .map(|_| id.to_owned());
    }
    let coordinate = Coordinate::parse(value(event, address_key)?).ok()?;
    if coordinate.kind.to_string() != kind {
        return None;
    }
    store.addressed(&coordinate).map(|event| event.id.clone())
}
fn valid_root_scope(store: &Store, event: &NostrEvent) -> bool {
    let Some(kind) = value(event, "K") else {
        return false;
    };
    if let Some(id) = value(event, "E").filter(|id| is_event_id(id)) {
        return store
            .get(id)
            .is_none_or(|root| root.kind.to_string() == kind);
    }
    if let Some(coordinate) = value(event, "A").and_then(|value| Coordinate::parse(value).ok()) {
        return coordinate.kind.to_string() == kind;
    }
    value(event, "I").is_some_and(|value| !value.is_empty())
}
/// The immediate event parent of a NIP-22 comment, or none for external scopes.
pub(crate) fn parent(store: &Store, event: &NostrEvent) -> Option<String> {
    (event.kind == 1111 && valid_root_scope(store, event))
        .then(|| resolve(store, event, "parent"))
        .flatten()
}
/// The root event of a NIP-22 comment, used to connect context across gaps.
pub(crate) fn root(store: &Store, event: &NostrEvent) -> Option<String> {
    (event.kind == 1111 && valid_root_scope(store, event))
        .then(|| resolve(store, event, "root"))
        .flatten()
}

/// Canonical address used only to find comments whose parent uses an `a` tag.
pub(crate) fn address(event: &NostrEvent) -> Option<String> {
    if !matches!(event.kind, 0 | 3 | 10000..=19999 | 30000..=39999) {
        return None;
    }
    let identifier = if event.kind >= 30000 {
        value(event, "d").unwrap_or("")
    } else {
        ""
    };
    Some(format!("{}:{}:{identifier}", event.kind, event.pubkey))
}
