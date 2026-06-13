use lkjstr_app::{
    GLOBAL_MAX_AUTO_EMPTY_OLDER_REQUESTS, GlobalHistoryExhaustion, GlobalOlderBlockReason,
    GlobalOlderIntent, GlobalOlderIntentInput, GlobalOlderLoadTrigger, GlobalOlderPageInput,
    global_cursor_contains, older_global_cursor, plan_global_older_intent, plan_global_older_page,
};

#[test]
fn older_global_cursor_ends_before_oldest_record() {
    let cursor = older_global_cursor(2_000);

    assert_eq!(cursor.since, 1_940);
    assert_eq!(cursor.until, 1_999);
    assert!(global_cursor_contains(1_999, cursor));
    assert!(!global_cursor_contains(2_000, cursor));
}

#[test]
fn complete_empty_global_older_window_advances_without_exhaustion() {
    let outcome = plan_global_older_page(GlobalOlderPageInput {
        older_cursor_created_at: 2_000,
        merged_oldest_created_at: None,
        local_older_records_found: false,
        incoming_records_found: false,
        relay_read_complete: true,
    });

    assert_eq!(outcome.older_cursor_created_at, 1_940);
    assert!(outcome.has_older);
    assert_eq!(outcome.history_exhaustion, GlobalHistoryExhaustion::Probing);
}

#[test]
fn complete_lower_bound_without_global_rows_proves_exhaustion() {
    let outcome = plan_global_older_page(GlobalOlderPageInput {
        older_cursor_created_at: 50,
        merged_oldest_created_at: None,
        local_older_records_found: false,
        incoming_records_found: false,
        relay_read_complete: true,
    });

    assert_eq!(outcome.older_cursor_created_at, 0);
    assert!(!outcome.has_older);
    assert_eq!(outcome.history_exhaustion, GlobalHistoryExhaustion::Proven);
}

#[test]
fn global_intent_allows_underfilled_auto_then_requires_downward_scroll() {
    assert_eq!(
        plan_global_older_intent(intent(
            GlobalOlderLoadTrigger::ViewportFill,
            false,
            false,
            0
        )),
        GlobalOlderIntent::Request {
            older_cursor_created_at: 2_000
        }
    );
    assert_eq!(
        plan_global_older_intent(intent(GlobalOlderLoadTrigger::NearEnd, true, false, 0)),
        GlobalOlderIntent::Blocked(GlobalOlderBlockReason::NeedsCurrentDownwardScroll)
    );
    assert_eq!(
        plan_global_older_intent(intent(
            GlobalOlderLoadTrigger::Scroll,
            true,
            true,
            GLOBAL_MAX_AUTO_EMPTY_OLDER_REQUESTS,
        )),
        GlobalOlderIntent::Request {
            older_cursor_created_at: 2_000
        }
    );
}

#[test]
fn global_automatic_empty_history_requests_are_capped() {
    assert_eq!(
        plan_global_older_intent(intent(
            GlobalOlderLoadTrigger::ViewportFill,
            false,
            false,
            GLOBAL_MAX_AUTO_EMPTY_OLDER_REQUESTS,
        )),
        GlobalOlderIntent::Blocked(GlobalOlderBlockReason::AutomaticEmptyCapReached)
    );
}

fn intent(
    trigger: GlobalOlderLoadTrigger,
    scrollable: bool,
    user_scrolled_down: bool,
    automatic_empty_requests: u8,
) -> GlobalOlderIntentInput {
    GlobalOlderIntentInput {
        has_older: true,
        loading_older: false,
        older_cursor_created_at: Some(2_000),
        trigger,
        scrollable,
        user_scrolled_down,
        automatic_empty_requests,
    }
}
