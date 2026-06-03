use super::*;

const START_MS: u64 = 1_000;
const NOW_MS: u64 = 2_000;

fn key(relay_url: &str) -> RelayReadScoreKey {
    RelayReadScoreKey {
        relay_url: relay_url.to_owned(),
        surface: "home".to_owned(),
        phase: "page".to_owned(),
        direction: "older".to_owned(),
        route_group_key: "selected".to_owned(),
        filter_shape: "[{\"kinds\":[1],\"limit\":20}]".to_owned(),
        purpose: "feed".to_owned(),
    }
}

fn observation(key: RelayReadScoreKey) -> RelayReadObservation {
    RelayReadObservation {
        key,
        started_at_ms: START_MS,
        first_event_ms: Some(START_MS + 100),
        eose_ms: Some(START_MS + 500),
        duration_ms: 500,
        event_count: 6,
        unique_event_count: 5,
        final_count: 6,
        timeout: false,
        closed: false,
        auth: false,
        socket_error: false,
        event_limit_reached: false,
        bytes_sent: 100,
        bytes_received: 1_000,
        updated_at_ms: NOW_MS,
    }
}

#[test]
fn relay_score_initial_is_neutral() {
    let score = RelayReadScore::neutral(key("wss://a.example/"), NOW_MS);

    assert_near(score.reliability, NEUTRAL_COMPONENT);
    assert_near(score.first_event_speed, NEUTRAL_COMPONENT);
    assert_near(score.eose_speed, NEUTRAL_COMPONENT);
    assert_near(score.useful_yield, NEUTRAL_COMPONENT);
    assert_near(score.unique_yield, NEUTRAL_COMPONENT);
    assert_near(score.penalty, NEUTRAL_PENALTY);
    assert_eq!(score.sample_count, 0);
}

#[test]
fn relay_score_eose_success_increases_reliability() {
    let previous = RelayReadScore::neutral(key("wss://a.example/"), START_MS);
    let updated = update_relay_read_score(&previous, &observation(previous.key.clone()));

    assert!(updated.reliability > previous.reliability);
    assert_eq!(updated.sample_count, 1);
}

#[test]
fn relay_score_timeout_penalizes_without_erasing_history() {
    let previous = RelayReadScore::neutral(key("wss://a.example/"), START_MS);
    let success = update_relay_read_score(&previous, &observation(previous.key.clone()));
    let mut timeout = observation(success.key.clone());
    timeout.timeout = true;
    timeout.eose_ms = None;
    timeout.updated_at_ms = NOW_MS + 1;
    let updated = update_relay_read_score(&success, &timeout);

    assert!(updated.reliability > 0.6);
    assert!(updated.reliability < success.reliability);
    assert!(updated.penalty > success.penalty);
}

#[test]
fn relay_score_event_limit_is_density_not_transport_failure() {
    let previous = RelayReadScore::neutral(key("wss://a.example/"), START_MS);
    let mut dense = observation(previous.key.clone());
    dense.event_limit_reached = true;
    let updated = update_relay_read_score(&previous, &dense);

    assert!(updated.reliability > 0.9);
    assert!(updated.penalty > 0.0);
    assert!(updated.penalty <= EVENT_LIMIT_PENALTY);
}

#[test]
fn relay_score_first_event_improves_first_event_speed() {
    let previous = RelayReadScore::neutral(key("wss://a.example/"), START_MS);
    let mut no_first = observation(previous.key.clone());
    no_first.first_event_ms = None;
    let slow = update_relay_read_score(&previous, &no_first);
    let fast = update_relay_read_score(&previous, &observation(previous.key.clone()));

    assert!(fast.first_event_speed > slow.first_event_speed);
}

#[test]
fn relay_score_unique_yield_rewards_non_duplicate_events() {
    let previous = RelayReadScore::neutral(key("wss://a.example/"), START_MS);
    let mut duplicate = observation(previous.key.clone());
    duplicate.event_count = 10;
    duplicate.unique_event_count = 2;
    let mut unique = duplicate.clone();
    unique.unique_event_count = 10;

    let duplicate_score = update_relay_read_score(&previous, &duplicate);
    let unique_score = update_relay_read_score(&previous, &unique);

    assert!(unique_score.unique_yield > duplicate_score.unique_yield);
    assert!(unique_score.score > duplicate_score.score);
}

#[test]
fn relay_score_stale_entries_decay_toward_neutral() {
    let previous = RelayReadScore::neutral(key("wss://a.example/"), START_MS);
    let updated = update_relay_read_score(&previous, &observation(previous.key.clone()));
    let decayed = decay_relay_read_score(
        &updated,
        updated.updated_at_ms + RELAY_RELIABILITY_HALF_LIFE_MS,
        RELAY_RELIABILITY_HALF_LIFE_MS,
    );

    assert!(decayed.reliability < updated.reliability);
    assert!(decayed.reliability > NEUTRAL_COMPONENT);
}

#[test]
fn relay_score_ordering_preserves_fairness_retry() {
    let recent_key = key("wss://recent.example/");
    let old_key = key("wss://old.example/");
    let now_ms = FAIRNESS_FULL_CREDIT_MS * 3;
    let recent = timeout_score(recent_key, now_ms);
    let old = timeout_score(old_key, now_ms - FAIRNESS_FULL_CREDIT_MS * 2);
    let ordered = order_relay_read_scores(&[recent, old], now_ms);

    assert_eq!(
        ordered.first().map(|score| score.key.relay_url.as_str()),
        Some("wss://old.example/")
    );
}

#[test]
fn relay_score_key_does_not_include_tab_or_pane_ids() {
    let id = score_key_id(&key("wss://a.example/"));

    assert!(!id.contains("tab-123"));
    assert!(!id.contains("pane-123"));
}

#[test]
fn relay_score_key_normalizes_filter_shape() {
    let left = normalize_filter_shape("[{\"limit\":20,\"kinds\":[1]}]");
    let right = normalize_filter_shape("[{\"kinds\":[1],\"limit\":20}]");

    assert_eq!(left, right);
}

fn timeout_score(key: RelayReadScoreKey, updated_at_ms: u64) -> RelayReadScore {
    let previous = RelayReadScore::neutral(key.clone(), updated_at_ms);
    let mut timeout = observation(key);
    timeout.timeout = true;
    timeout.eose_ms = None;
    timeout.updated_at_ms = updated_at_ms;
    update_relay_read_score(&previous, &timeout)
}

fn assert_near(value: f64, expected: f64) {
    assert!((value - expected).abs() < 0.000_001);
}
