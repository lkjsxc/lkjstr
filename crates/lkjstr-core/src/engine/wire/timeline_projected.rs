//! Time index for lists whose rows are not one event each: grouped notifications, a Home that
//! interleaves them with notes, and profile reposts/reactions. Their window renders one projection
//! of the whole cached list (sources.rs); a build takes that projection once, as (key, time) pairs in
//! window order, then counts at most 256 rows per client Worker turn. Ordinals therefore name exactly
//! the rows a window anchored at their key shows. Bound: one store-sized list per build, released
//! when the build finishes or the subscription closes.
use super::timeline::{Index, month_start};
use crate::calendar::Calendar;
use crate::engine::protocol::{Query, Source};
use serde_json::Value;

pub(super) fn projected(q: &Query) -> bool {
    q.source == Source::Notifications
        || q.filters.notifications == Some(true)
        || crate::engine::acts::activity(q)
}

/// Rows a reader scrolls through, in window order. Pinned profile/channel headers and search people
/// are not part of the chronology and never take an ordinal.
pub(super) fn rows(projection: &[Value]) -> Vec<(String, u64)> {
    projection
        .iter()
        .filter(|row| matches!(row["kind"].as_str(), Some("note" | "notification")))
        .filter_map(|row| Some((row["key"].as_str()?.to_owned(), row["at"].as_u64()?)))
        .collect()
}

pub(super) fn subscription_rows(
    session: &super::Session,
    sub: &str,
    engine: &crate::engine::Engine,
    query: &Query,
    horizon: Option<u64>,
) -> Vec<(String, u64)> {
    let mut chronology = if session.projects_source(sub) || projected(query) {
        rows(&session.project_source(sub, engine, false))
    } else {
        session.view(sub, engine).map_or_else(Vec::new, |view| {
            covered_rows(view, engine, horizon.max(view.history_horizon))
        })
    };
    chronology.retain(|(_, time)| horizon.is_none_or(|at| time / 1000 >= at));
    chronology
}

fn covered_rows(
    view: &crate::engine::View,
    engine: &crate::engine::Engine,
    horizon: Option<u64>,
) -> Vec<(String, u64)> {
    use crate::engine::{even_history, global, query, windows};
    let bounded = even_history::bounded_query(&view.query, horizon);
    query::events_with_placement(&engine.store, &bounded)
        .into_iter()
        .filter(|(event, _)| {
            (!matches!(event.kind, 6 | 16) || query::their_repost(&engine.store, &bounded, event))
                && horizon.is_none_or(|at| event.created_at >= at)
                && global::has_slot(windows::reason(
                    &engine.store,
                    view,
                    event,
                    &engine.private_lists,
                ))
        })
        .map(|(event, placement)| (event.id.clone(), placement.saturating_mul(1000)))
        .collect()
}

pub(super) fn slice(index: &mut Index, calendar: &dyn Calendar, now: u64) {
    let Some(rows) = index.rows.as_ref() else {
        return;
    };
    let end = (index.next + 256).min(rows.len());
    let batch: Vec<_> = rows[index.next..end].to_vec();
    index.next = end;
    let finished = end >= rows.len();
    for (key, at) in batch {
        if index.positions.contains_key(&key) {
            continue;
        }
        // Months stay monotonic in window order even where a row's own time is newer than the
        // row above it; the position keeps the row's own time for its label.
        let place = at.min(now).min(index.oldest_or(now));
        index.newest.get_or_insert(place);
        index.oldest = place;
        let month = month_start(place / 1000);
        let keys = index.keys.entry(month).or_default();
        let offset = keys.len();
        index.positions.insert(key.clone(), (month, offset, at));
        keys.push(key);
        index.days.count(calendar, place, month, offset);
    }
    if finished {
        index.done = true;
        index.rows = None;
    }
}

impl Index {
    fn oldest_or(&self, now: u64) -> u64 {
        if self.newest.is_some() {
            self.oldest
        } else {
            now
        }
    }
}
