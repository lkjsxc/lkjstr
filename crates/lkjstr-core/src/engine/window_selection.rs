use super::{Selection, projection};
use crate::engine::{View, global, network, protocol::Source, rich, settings};
use crate::store::{Event, Store};

fn plan(store: &Store, v: &View, events: &[Event]) -> (usize, usize) {
    if let Some(tail) = &v.head_through {
        let through = events
            .iter()
            .position(|event| rich::anchored(store, event, tail, &v.query))
            .map_or(0, |at| at + 1);
        return (0, through.max(v.after + 1).min(super::HEAD_ROWS));
    }
    let at = v
        .anchor
        .as_ref()
        .and_then(|id| {
            events
                .iter()
                .position(|e| rich::anchored(store, e, id, &v.query))
                .or_else(|| {
                    crate::engine::even_history::holds_anchor(store, v, id).then_some(events.len())
                })
        })
        .unwrap_or(0);
    let mut start = at;
    let mut above = 0;
    while start > 0 && above < v.before {
        start -= 1;
        if !projection::unavailable(store, &v.query, &events[start]) {
            above += 1;
        }
    }
    // Keep adjacent invisible targets owned when the first note is anchored.
    while start > 0 && projection::unavailable(store, &v.query, &events[start - 1]) {
        start -= 1;
    }
    (start, above.saturating_add(v.after).saturating_add(1))
}

/// Refill from raw rows so every retained anchor can reach older cached notes.
/// Hydration and history use this same raw span, including withheld authors.
pub(in crate::engine) fn selection(
    store: &Store,
    _network: &network::Network,
    v: &View,
    enabled: bool,
    events: &[Event],
    private: &settings::PrivateLists,
) -> Selection {
    if let Some(pivot) = &v.time_window {
        return crate::engine::time_window::select(store, v, pivot.at, events, private);
    }
    let (start, quota) = plan(store, v, events);
    let held = if enabled && v.query.account.is_none() && v.query.source == Source::Global {
        global::classify_window(
            &events[start..],
            |e| projection::unavailable(store, &v.query, e),
            |e| crate::engine::visibility::reason(store, &v.query, e, private),
            quota,
        )
    } else {
        let mut visible = 0;
        events[start..]
            .iter()
            .scan((), |_, event| {
                if visible >= quota {
                    return None;
                }
                let reason = reason(store, v, event, private);
                if global::has_slot(reason) {
                    visible += 1;
                }
                Some(reason)
            })
            .collect()
    };
    Selection {
        raw: start..start + held.len(),
        held,
        quota,
    }
}

pub(in crate::engine) fn reason(
    store: &Store,
    v: &View,
    event: &Event,
    private: &settings::PrivateLists,
) -> Option<global::Held> {
    // Person membership is independent of contact-list payloads and note mutes.
    if !crate::engine::acts::notification_visible(store, &v.query, event) {
        return Some(global::Held::NoRow);
    }
    if matches!(
        v.query.source,
        Source::Followers | Source::Following | Source::Mutes | Source::List
    ) {
        return None;
    }
    let reason = crate::engine::visibility::reason(store, &v.query, event, private);
    if projection::unavailable(store, &v.query, event) {
        return Some(if reason.is_some() {
            global::Held::NoRow
        } else {
            global::Held::UnavailableRepost
        });
    }
    reason.map(global::Held::Hidden)
}
