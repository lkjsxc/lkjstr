//! Isolate a finite relay read by direction, view, exact pivot and verified list.
use super::{
    View,
    network::Network,
    protocol::{Query, Source, TimeEdge},
    rows::Row,
};
use crate::store::Store;
use lkjstr_protocol::NostrFilter;

#[derive(Clone, Copy)]
pub(super) enum Side {
    Older,
    Newer,
}

impl Side {
    fn prefix(self) -> &'static str {
        match self {
            Self::Older => "~time-older:",
            Self::Newer => "~time-newer:",
        }
    }

    fn owner(self, store: &Store, sub: &str, view: &View) -> Option<String> {
        let pivot = view.time_window.as_ref()?;
        let rows = match self {
            Self::Older => view.after,
            Self::Newer => view.before,
        };
        if !view.visible || rows == 0 || view.query.source != Source::TheirHome {
            return None;
        }
        let list = store.replaceable(view.query.target.as_deref()?, 3)?;
        Some(format!("{}{}:{}:{sub}", self.prefix(), pivot.at, list.id))
    }

    fn intent(self, store: &Store, sub: &str, view: &View) -> Option<(String, NostrFilter, Query)> {
        let owner = self.owner(store, sub, view)?;
        let pivot = view.time_window.as_ref()?;
        let second = pivot.at / 1000;
        let mut filter = super::query::filter(store, &view.query);
        let upper = match self {
            Self::Older => second,
            Self::Newer => {
                filter.since = Some((second + 1).max(filter.since.unwrap_or(0)));
                pivot.newer_until
            }
        };
        let until = upper.min(filter.until.unwrap_or(upper));
        if filter.authors.as_ref()?.is_empty() || filter.since.is_some_and(|since| since > until) {
            return None;
        }
        filter.until = Some(until);
        Some((owner, filter, view.query.clone()))
    }
}

pub(super) fn is_owner(member: &str) -> bool {
    owner_suffix(member).is_some()
}

pub(super) fn is_newer(member: &str) -> bool {
    member.starts_with(Side::Newer.prefix())
}

pub(super) fn view_owner(member: &str) -> Option<&str> {
    owner_suffix(member)?.splitn(3, ':').nth(2)
}

fn owner_suffix(member: &str) -> Option<&str> {
    member
        .strip_prefix(Side::Older.prefix())
        .or_else(|| member.strip_prefix(Side::Newer.prefix()))
}

pub(super) fn intents<'a>(
    store: &'a Store,
    sub: &'a str,
    view: &'a View,
) -> impl Iterator<Item = (String, NostrFilter, Query)> + 'a {
    [Side::Older, Side::Newer]
        .into_iter()
        .filter_map(|side| side.intent(store, sub, view))
}

pub(super) fn edges(
    network: &mut Network,
    store: &Store,
    sub: &str,
    view: &View,
    items: &[Row],
) -> [TimeEdge; 2] {
    let Some(pivot) = &view.time_window else {
        return [TimeEdge::CacheOnly; 2];
    };
    let row_time = |row: &Row| row.reposted_at.unwrap_or(row.created_at);
    [Side::Older, Side::Newer].map(|side| {
        let Some(owner) = side.owner(store, sub, view) else {
            return TimeEdge::CacheOnly;
        };
        let through = match side {
            Side::Older => {
                let older = items.partition_point(|row| row_time(row) > pivot.at / 1000);
                items.get(older + view.after - 1).map(row_time)
            }
            Side::Newer => None,
        };
        network.time_edge(&owner, store, through)
    })
}
