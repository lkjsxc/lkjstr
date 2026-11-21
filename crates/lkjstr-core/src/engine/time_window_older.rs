//! Scope the older relay read to one visible Their Home and its verified list.
use super::{
    View,
    protocol::{Query, Source},
};
use crate::store::Store;
use lkjstr_protocol::NostrFilter;

const PREFIX: &str = "~time-older:";

pub(super) fn is_owner(member: &str) -> bool {
    member.starts_with(PREFIX)
}

pub(super) fn view_owner(member: &str) -> Option<&str> {
    member.strip_prefix(PREFIX)?.splitn(3, ':').nth(2)
}

pub(super) fn owner(store: &Store, sub: &str, view: &View) -> Option<String> {
    let pivot = view.time_window.as_ref()?;
    if !view.visible || view.after == 0 || view.query.source != Source::TheirHome {
        return None;
    }
    let list = store.replaceable(view.query.target.as_deref()?, 3)?;
    Some(format!("{PREFIX}{}:{}:{sub}", pivot.at, list.id))
}

pub(super) fn intent(
    store: &Store,
    sub: &str,
    view: &View,
) -> Option<(String, NostrFilter, Query)> {
    let owner = owner(store, sub, view)?;
    let second = view.time_window.as_ref()?.at / 1000;
    let mut filter = super::query::filter(store, &view.query);
    let until = second.min(filter.until.unwrap_or(second));
    if filter.authors.as_ref()?.is_empty() || filter.since.is_some_and(|since| since > until) {
        return None;
    }
    filter.until = Some(until);
    Some((owner, filter, view.query.clone()))
}
