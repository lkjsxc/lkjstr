use lkjstr_app::{
    NOTIFICATION_CLOCK_SKEW_SECONDS, NOTIFICATION_MAX_AUTO_EMPTY_OLDER_REQUESTS,
    NotificationsHistoryExhaustion, NotificationsOlderBlockReason, NotificationsOlderIntent,
    NotificationsOlderIntentInput, NotificationsOlderLoadTrigger, NotificationsOlderPageInput,
    initial_notification_cursor, notification_cursor_contains, older_notification_cursor,
    plan_notifications_older_intent, plan_notifications_older_page,
};

#[test]
fn initial_notifications_cursor_uses_adaptive_span_and_clock_skew() {
    let cursor = initial_notification_cursor(5_000);

    assert_eq!(cursor.since, 4_940);
    assert_eq!(cursor.until, 5_000 + NOTIFICATION_CLOCK_SKEW_SECONDS);
    assert!(notification_cursor_contains(5_000, cursor));
    assert!(!notification_cursor_contains(4_939, cursor));
}

#[test]
fn older_notifications_cursor_ends_before_oldest_record() {
    let cursor = older_notification_cursor(2_000);

    assert_eq!(cursor.since, 1_940);
    assert_eq!(cursor.until, 1_999);
}

#[test]
fn complete_empty_older_window_advances_without_exhaustion() {
    let outcome = plan_notifications_older_page(NotificationsOlderPageInput {
        older_cursor_created_at: 2_000,
        merged_oldest_created_at: None,
        local_older_records_found: false,
        incoming_records_found: false,
        relay_read_complete: true,
    });

    assert_eq!(outcome.older_cursor_created_at, 1_940);
    assert!(outcome.has_older);
    assert_eq!(
        outcome.history_exhaustion,
        NotificationsHistoryExhaustion::Probing
    );
}

#[test]
fn complete_lower_bound_without_local_rows_proves_exhaustion() {
    let outcome = plan_notifications_older_page(NotificationsOlderPageInput {
        older_cursor_created_at: 50,
        merged_oldest_created_at: None,
        local_older_records_found: false,
        incoming_records_found: false,
        relay_read_complete: true,
    });

    assert_eq!(outcome.older_cursor_created_at, 0);
    assert!(!outcome.has_older);
    assert_eq!(
        outcome.history_exhaustion,
        NotificationsHistoryExhaustion::Proven
    );
}

#[test]
fn incomplete_lower_bound_remains_retryable() {
    let outcome = plan_notifications_older_page(NotificationsOlderPageInput {
        older_cursor_created_at: 50,
        merged_oldest_created_at: None,
        local_older_records_found: false,
        incoming_records_found: false,
        relay_read_complete: false,
    });

    assert_eq!(outcome.older_cursor_created_at, 50);
    assert!(outcome.has_older);
    assert_eq!(
        outcome.history_exhaustion,
        NotificationsHistoryExhaustion::Unknown
    );
}

#[test]
fn fill_then_scroll_allows_underfilled_auto_then_requires_scroll() {
    assert_eq!(
        plan_notifications_older_intent(intent(
            NotificationsOlderLoadTrigger::ViewportFill,
            false,
            false,
            0,
        )),
        NotificationsOlderIntent::Request {
            older_cursor_created_at: 2_000
        }
    );
    assert_eq!(
        plan_notifications_older_intent(intent(
            NotificationsOlderLoadTrigger::NearEnd,
            true,
            false,
            0,
        )),
        NotificationsOlderIntent::Blocked(
            NotificationsOlderBlockReason::NeedsCurrentDownwardScroll
        )
    );
    assert_eq!(
        plan_notifications_older_intent(intent(
            NotificationsOlderLoadTrigger::Scroll,
            true,
            true,
            NOTIFICATION_MAX_AUTO_EMPTY_OLDER_REQUESTS,
        )),
        NotificationsOlderIntent::Request {
            older_cursor_created_at: 2_000
        }
    );
}

#[test]
fn automatic_empty_history_requests_are_capped() {
    assert_eq!(
        plan_notifications_older_intent(intent(
            NotificationsOlderLoadTrigger::ViewportFill,
            false,
            false,
            NOTIFICATION_MAX_AUTO_EMPTY_OLDER_REQUESTS,
        )),
        NotificationsOlderIntent::Blocked(NotificationsOlderBlockReason::AutomaticEmptyCapReached)
    );
}

fn intent(
    trigger: NotificationsOlderLoadTrigger,
    scrollable: bool,
    user_scrolled_down: bool,
    automatic_empty_requests: u8,
) -> NotificationsOlderIntentInput {
    NotificationsOlderIntentInput {
        has_older: true,
        loading_older: false,
        older_cursor_created_at: Some(2_000),
        trigger,
        scrollable,
        user_scrolled_down,
        automatic_empty_requests,
    }
}
