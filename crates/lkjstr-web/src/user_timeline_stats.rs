use std::{cell::RefCell, collections::BTreeMap};

use lkjstr_app::{FeedViewRow, UserTimelineFeedStatus, UserTimelineFeedView};
use serde::Serialize;
use wasm_bindgen::prelude::{JsValue, wasm_bindgen};

thread_local! {
    static COUNTERS: RefCell<UserTimelineStatsCounters> = RefCell::new(UserTimelineStatsCounters::default());
}

#[derive(Default)]
struct UserTimelineStatsCounters {
    statuses: BTreeMap<&'static str, u64>,
    reasons: BTreeMap<&'static str, u64>,
}

#[derive(Serialize)]
struct UserTimelineStatsSnapshot {
    status: &'static str,
    outcomes: Vec<UserTimelineStatsCount>,
    reasons: Vec<UserTimelineStatsCount>,
}

#[derive(Serialize)]
struct UserTimelineStatsCount {
    key: &'static str,
    count: u64,
}

pub(crate) fn record_model(model: &UserTimelineFeedView) {
    COUNTERS.with_borrow_mut(|counters| {
        increment(&mut counters.statuses, status_key(model.status));
        for row in &model.view_model.rows {
            if let Some(key) = reason_key(row) {
                increment(&mut counters.reasons, key);
            }
        }
    });
}

#[wasm_bindgen]
pub fn user_timeline_diagnostics_snapshot() -> JsValue {
    to_value(&COUNTERS.with_borrow(UserTimelineStatsCounters::snapshot))
}

#[cfg(debug_assertions)]
#[wasm_bindgen]
pub fn reset_user_timeline_diagnostics_for_test() {
    COUNTERS.with_borrow_mut(UserTimelineStatsCounters::clear);
}

impl UserTimelineStatsCounters {
    fn snapshot(&self) -> UserTimelineStatsSnapshot {
        UserTimelineStatsSnapshot {
            status: "available",
            outcomes: count_rows(&self.statuses),
            reasons: count_rows(&self.reasons),
        }
    }

    #[cfg(debug_assertions)]
    fn clear(&mut self) {
        self.statuses.clear();
        self.reasons.clear();
    }
}

fn count_rows(input: &BTreeMap<&'static str, u64>) -> Vec<UserTimelineStatsCount> {
    input
        .iter()
        .map(|(key, count)| UserTimelineStatsCount { key, count: *count })
        .collect()
}

fn increment(counters: &mut BTreeMap<&'static str, u64>, key: &'static str) {
    counters
        .entry(key)
        .and_modify(|count| *count = count.saturating_add(1))
        .or_insert(1);
}

fn reason_key(row: &FeedViewRow) -> Option<&'static str> {
    match row {
        FeedViewRow::Diagnostic(row) => diagnostic_key(&row.diagnostic_id),
        FeedViewRow::Unavailable(row) => unavailable_key(&row.reason),
        _ => None,
    }
}

fn diagnostic_key(id: &str) -> Option<&'static str> {
    match id {
        "relay-settings" => Some("relay-settings"),
        "author-routes" => Some("author-routes"),
        "cache-follow-list" => Some("cache-follow-list"),
        value if value.starts_with("selected-relay-") => Some("selected-relay"),
        value if value.starts_with("author-route-") => Some("author-route"),
        _ => Some("other-diagnostic"),
    }
}

fn unavailable_key(reason: &str) -> Option<&'static str> {
    match reason {
        "missing-user-timeline-pubkey" => Some("missing-pubkey"),
        "no-user-timeline-relay" => Some("no-enabled-relay"),
        "target-posts-only" => Some("target-posts-only"),
        "partial-user-timeline" => Some("partial-user-timeline"),
        _ => None,
    }
}

fn status_key(status: UserTimelineFeedStatus) -> &'static str {
    match status {
        UserTimelineFeedStatus::MissingPubkey => "missing-pubkey",
        UserTimelineFeedStatus::LoadingDiscovery => "loading-discovery",
        UserTimelineFeedStatus::NoEnabledRelay => "no-enabled-relay",
        UserTimelineFeedStatus::Ready => "ready",
        UserTimelineFeedStatus::TargetPostsOnly => "target-posts-only",
        UserTimelineFeedStatus::Partial => "partial",
        UserTimelineFeedStatus::Incomplete => "incomplete",
        UserTimelineFeedStatus::Failed => "failed",
        UserTimelineFeedStatus::AuthRequired => "auth-required",
        UserTimelineFeedStatus::RateLimited => "rate-limited",
        UserTimelineFeedStatus::Offline => "offline",
    }
}

fn to_value(snapshot: &UserTimelineStatsSnapshot) -> JsValue {
    serde_wasm_bindgen::to_value(snapshot).unwrap_or(JsValue::NULL)
}
