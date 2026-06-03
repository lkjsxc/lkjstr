use super::*;

#[test]
fn feed_wait_renders_cache_immediately() {
    let decision = decide_feed_wait(&input(0, 2, 0, true));

    assert!(decision.paint);
    assert_eq!(decision.state, FeedWaitState::IncompleteRows);
}

#[test]
fn feed_wait_paints_fast_relay_before_slow_eose() {
    let decision = decide_feed_wait(&input(100, 0, 1, true));

    assert!(decision.paint);
    assert_eq!(decision.state, FeedWaitState::IncompleteRows);
}

#[test]
fn feed_wait_never_shows_empty_while_relays_pending() {
    let decision = decide_feed_wait(&input(400, 0, 0, true));

    assert!(decision.paint);
    assert_eq!(decision.state, FeedWaitState::Checking);
}

#[test]
fn feed_wait_timeout_with_rows_is_incomplete_not_empty() {
    let mut wait = input(5_000, 0, 1, false);
    wait.timeout = true;
    let decision = decide_feed_wait(&wait);

    assert_eq!(decision.state, FeedWaitState::IncompleteRows);
}

#[test]
fn feed_wait_late_newer_event_merges_above_fast_older_event() {
    let result =
        merge_late_event_rows(&[row("old", 10, 1)], &[row("new", 20, 1)], &anchor(true), 1);

    assert_eq!(ids(&result.rows), vec!["new", "old"]);
    assert!(!result.anchor.preserve_anchor);
}

#[test]
fn feed_wait_late_insert_preserves_scroll_anchor_when_scrolled() {
    let result = merge_late_event_rows(
        &[row("old", 10, 1)],
        &[row("new", 20, 1)],
        &anchor(false),
        1,
    );

    assert!(result.anchor.preserve_anchor);
    assert!(result.anchor.stage_newer_available);
}

#[test]
fn feed_wait_context_unavailable_replaced_by_late_real_event() {
    let mut wait = input(CONTEXT_UNAVAILABLE_WAIT_MS, 0, 0, false);
    wait.exact_context_read = true;
    let decision = decide_feed_wait(&wait);
    let merged = merge_late_event_rows(&[], &[row("context", 1, 1)], &anchor(true), 1);

    assert_eq!(decision.state, FeedWaitState::ContextUnavailable);
    assert_eq!(ids(&merged.rows), vec!["context"]);
}

#[test]
fn feed_wait_cancelled_generation_ignores_late_events() {
    let merged =
        merge_late_event_rows(&[row("kept", 1, 2)], &[row("late", 2, 1)], &anchor(true), 2);
    let mut wait = input(0, 0, 0, true);
    wait.generation = 1;
    wait.current_generation = 2;

    assert_eq!(ids(&merged.rows), vec!["kept"]);
    assert_eq!(decide_feed_wait(&wait).state, FeedWaitState::Cancelled);
}

fn input(
    now_ms: u64,
    cache_row_count: usize,
    relay_row_count: usize,
    relays_pending: bool,
) -> FeedWaitInput {
    FeedWaitInput {
        now_ms,
        read_started_at_ms: 0,
        cache_row_count,
        relay_row_count,
        relays_pending,
        contacted_relays_terminal: false,
        complete_coverage_proves_absence: false,
        timeout: false,
        exact_context_read: false,
        generation: 1,
        current_generation: 1,
    }
}

fn row(event_id: &str, created_at: u64, generation: u64) -> FeedWaitEventRow {
    FeedWaitEventRow {
        event_id: event_id.to_owned(),
        created_at,
        generation,
    }
}

fn anchor(near_top: bool) -> ScrollAnchor {
    ScrollAnchor {
        event_id: Some("old".to_owned()),
        offset_px: 0,
        near_top,
    }
}

fn ids(rows: &[FeedWaitEventRow]) -> Vec<&str> {
    rows.iter().map(|row| row.event_id.as_str()).collect()
}
