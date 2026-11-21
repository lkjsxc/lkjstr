//! Retained note selection around an absolute time, independent of rail ordinals.
use super::{
    Engine, View,
    global::Held,
    protocol::{FollowList, Output, Query, Source, TimeEdge},
    rows::Row,
    settings::PrivateLists,
    windows::{Selection, reason},
};
use crate::store::{Event, Store};
use lkjstr_protocol::NostrFilter;
use std::cmp::Reverse;

#[path = "time_window_order.rs"]
mod order;
pub(super) use order::Order;

pub(super) struct Pivot {
    pub(super) at: u64,
    pub(super) newer_until: u64,
    key: Option<String>,
    newer: TimeEdge,
    older: TimeEdge,
    follow_list: Option<FollowList>,
}

pub(super) fn supported(query: &Query) -> bool {
    query.filters.notifications != Some(true)
        && match query.source {
            Source::Home => !super::query::signed_out(query),
            Source::TheirHome => query
                .target
                .as_deref()
                .is_some_and(lkjstr_protocol::is_pubkey),
            _ => false,
        }
}

impl Engine {
    pub(super) fn window_at_time(
        &mut self,
        sub: &str,
        at: u64,
        before: usize,
        after: usize,
        now: u64,
    ) {
        let Some(view) = self
            .views
            .get_mut(sub)
            .filter(|view| supported(&view.query))
        else {
            self.outgoing.push(Output::TimeWindow {
                sub: sub.into(),
                at,
                key: None,
                newer: TimeEdge::Unsupported,
                older: TimeEdge::Unsupported,
                follow_list: None,
            });
            return;
        };
        view.anchor = None;
        view.head_through = None;
        if view.time_window.as_ref().is_none_or(|pivot| pivot.at != at) {
            view.reading = None;
            view.time_window = Some(Pivot {
                at,
                newer_until: now / 1000,
                key: None,
                newer: TimeEdge::CacheOnly,
                older: TimeEdge::CacheOnly,
                follow_list: None,
            });
        }
        view.before = before.min(800);
        view.after = after.min(800);
        view.history = None;
        view.notification_history = None;
        self.replan(now);
        self.render(sub, true);
    }
}

impl Pivot {
    pub(super) fn report(
        &mut self,
        sub: &str,
        rows: &[Row],
        follow_list: Option<FollowList>,
        [older, newer]: [TimeEdge; 2],
        full: bool,
        output: &mut Vec<Output>,
    ) {
        let key = rows
            .iter()
            .find(|row| row.reposted_at.unwrap_or(row.created_at) <= self.at / 1000)
            .or_else(|| {
                // A newer-only fallback would seat on a provisional relay row.
                if matches!(newer, TimeEdge::CacheOnly | TimeEdge::End) {
                    rows.last()
                } else {
                    None
                }
            })
            .map(|row| row.id.clone());
        if full
            || self.key != key
            || self.follow_list != follow_list
            || self.older != older
            || self.newer != newer
        {
            self.newer = newer;
            self.older = older;
            self.key.clone_from(&key);
            self.follow_list.clone_from(&follow_list);
            output.push(Output::TimeWindow {
                sub: sub.into(),
                at: self.at,
                key,
                newer,
                older,
                follow_list,
            });
        }
    }
}

pub(super) fn follow_list(store: &Store, query: &Query) -> Option<FollowList> {
    (query.source == Source::TheirHome).then(|| {
        query
            .target
            .as_deref()
            .and_then(|target| store.replaceable(target, 3))
            .map_or(FollowList::Unknown, |event| FollowList::LatestVerified {
                at: event.created_at.saturating_mul(1000),
                id: event.id.clone(),
            })
    })
}

pub(super) fn events(store: &Store, view: &View, private: &PrivateLists) -> Vec<Event> {
    let mut events = super::list_events::events(store, &view.query, private);
    if view.time_window.is_some() {
        let order = Order::new(store, &view.query);
        events.sort_by_cached_key(|event| Reverse((order.at(event), event.id.clone())));
    }
    events
}

pub(super) fn head(store: &Store, view: &View) -> Vec<NostrFilter> {
    if view.time_window.is_some() {
        vec![]
    } else {
        vec![super::query::filter(store, &view.query)]
    }
}

pub(super) fn select(
    store: &Store,
    view: &View,
    at: u64,
    events: &[Event],
    private: &PrivateLists,
) -> Selection {
    let order = Order::new(store, &view.query);
    let middle = events.partition_point(|event| order.at(event) > at / 1000);
    let mut held = side(events[..middle].iter().rev(), view.before, |event| {
        reason(store, view, event, private)
    });
    let start = middle - held.len();
    held.reverse();
    held.extend(side(events[middle..].iter(), view.after, |event| {
        reason(store, view, event, private)
    }));
    Selection {
        raw: start..start + held.len(),
        held,
        quota: view.before + view.after,
    }
}

fn side<'a>(
    events: impl Iterator<Item = &'a Event>,
    mut remaining: usize,
    mut classify: impl FnMut(&Event) -> Option<Held>,
) -> Vec<Option<Held>> {
    events
        .scan((), |_, event| {
            if remaining == 0 {
                return None;
            }
            let reason = classify(event);
            remaining -= usize::from(super::global::has_slot(reason));
            Some(reason)
        })
        .collect()
}
