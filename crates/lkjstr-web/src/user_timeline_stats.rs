use crate::runtime_counter_state::{child_slot, increment_counter, read_counter, slot};
use lkjstr_app::{FeedViewRow, UserTimelineFeedStatus, UserTimelineFeedView};
use serde::Serialize;
use wasm_bindgen::prelude::{wasm_bindgen, JsValue};

const SLOT: &str = "__lkjstrUserTimelineStats";
const STATUSES: &str = "statuses";
const REASONS: &str = "reasons";
const STATUS_KEYS: &[&str] = &[
    "missing-pubkey",
    "loading-discovery",
    "loading-feed",
    "no-enabled-relay",
    "ready",
    "target-posts-only",
    "partial",
    "incomplete",
    "failed",
    "auth-required",
    "rate-limited",
    "offline",
];
const REASON_KEYS: &[&str] = &[
    "relay-settings",
    "author-routes",
    "cache-follow-list",
    "selected-relay",
    "author-route",
    "other-diagnostic",
    "missing-pubkey",
    "no-enabled-relay",
    "target-posts-only",
    "partial-user-timeline",
    "incomplete-user-timeline-discovery",
];

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
    let state = slot(SLOT);
    let statuses = child_slot(&state, STATUSES);
    let reasons = child_slot(&state, REASONS);
    increment_counter(&statuses, status_key(model.status));
    for row in &model.view_model.rows {
        if let Some(key) = reason_key(row) {
            increment_counter(&reasons, key);
        }
    }
}

#[wasm_bindgen]
pub fn user_timeline_diagnostics_snapshot() -> JsValue {
    to_value(&snapshot())
}

#[cfg(debug_assertions)]
#[wasm_bindgen]
pub fn reset_user_timeline_diagnostics_for_test() {
    crate::runtime_counter_state::clear_slot(SLOT);
}

fn snapshot() -> UserTimelineStatsSnapshot {
    let state = slot(SLOT);
    let statuses = child_slot(&state, STATUSES);
    let reasons = child_slot(&state, REASONS);
    UserTimelineStatsSnapshot {
        status: "available",
        outcomes: count_rows(&statuses, STATUS_KEYS),
        reasons: count_rows(&reasons, REASON_KEYS),
    }
}

fn count_rows(input: &js_sys::Object, keys: &[&'static str]) -> Vec<UserTimelineStatsCount> {
    keys.iter()
        .filter_map(|key| {
            let count = read_counter(input, key);
            (count > 0).then_some(UserTimelineStatsCount { key, count })
        })
        .collect()
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
        "incomplete-user-timeline-discovery" => Some("incomplete-user-timeline-discovery"),
        _ => None,
    }
}

fn status_key(status: UserTimelineFeedStatus) -> &'static str {
    match status {
        UserTimelineFeedStatus::MissingPubkey => "missing-pubkey",
        UserTimelineFeedStatus::LoadingDiscovery => "loading-discovery",
        UserTimelineFeedStatus::LoadingFeed => "loading-feed",
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
