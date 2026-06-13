use lkjstr_app::{
    THREAD_MAX_AUTO_EMPTY_OLDER_REQUESTS, ThreadHistoryExhaustion, ThreadOlderBlockReason,
    ThreadOlderIntent, ThreadOlderIntentInput, ThreadOlderLoadTrigger, ThreadOlderPageInput,
    older_thread_cursor, plan_thread_older_intent, plan_thread_older_page, thread_cursor_contains,
};

#[test]
fn older_thread_cursor_ends_before_oldest_reply() {
    let cursor = older_thread_cursor(2_000);

    assert_eq!(cursor.since, 1_940);
    assert_eq!(cursor.until, 1_999);
    assert!(thread_cursor_contains(1_999, cursor));
    assert!(!thread_cursor_contains(2_000, cursor));
}

#[test]
fn complete_empty_thread_older_window_advances_without_exhaustion() {
    let outcome = plan_thread_older_page(ThreadOlderPageInput {
        older_cursor_created_at: 2_000,
        merged_oldest_created_at: None,
        local_older_records_found: false,
        incoming_records_found: false,
        relay_read_complete: true,
    });

    assert_eq!(outcome.older_cursor_created_at, 1_940);
    assert!(outcome.has_older);
    assert_eq!(outcome.history_exhaustion, ThreadHistoryExhaustion::Probing);
}

#[test]
fn complete_lower_thread_bound_without_rows_proves_exhaustion() {
    let outcome = plan_thread_older_page(ThreadOlderPageInput {
        older_cursor_created_at: 50,
        merged_oldest_created_at: None,
        local_older_records_found: false,
        incoming_records_found: false,
        relay_read_complete: true,
    });

    assert_eq!(outcome.older_cursor_created_at, 0);
    assert!(!outcome.has_older);
    assert_eq!(outcome.history_exhaustion, ThreadHistoryExhaustion::Proven);
}

#[test]
fn explicit_thread_older_intent_uses_current_cursor() {
    assert_eq!(
        plan_thread_older_intent(intent(ThreadOlderLoadTrigger::Explicit, true, false, 0)),
        ThreadOlderIntent::Request {
            older_cursor_created_at: 2_000
        }
    );
}

#[test]
fn automatic_thread_older_intent_requires_unscrollable_underfill() {
    assert_eq!(
        plan_thread_older_intent(intent(
            ThreadOlderLoadTrigger::NearEnd,
            true,
            false,
            THREAD_MAX_AUTO_EMPTY_OLDER_REQUESTS,
        )),
        ThreadOlderIntent::Blocked(ThreadOlderBlockReason::NeedsCurrentDownwardScroll)
    );
    assert_eq!(
        plan_thread_older_intent(intent(
            ThreadOlderLoadTrigger::ViewportFill,
            false,
            false,
            THREAD_MAX_AUTO_EMPTY_OLDER_REQUESTS,
        )),
        ThreadOlderIntent::Blocked(ThreadOlderBlockReason::AutomaticEmptyCapReached)
    );
}

fn intent(
    trigger: ThreadOlderLoadTrigger,
    scrollable: bool,
    user_scrolled_down: bool,
    automatic_empty_requests: u8,
) -> ThreadOlderIntentInput {
    ThreadOlderIntentInput {
        has_older: true,
        loading_older: false,
        older_cursor_created_at: Some(2_000),
        trigger,
        scrollable,
        user_scrolled_down,
        automatic_empty_requests,
    }
}
