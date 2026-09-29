use lkjstr_app::home_feed::paging::home_window_from_snapshot;
use lkjstr_app::{FeedWindowCursor, empty_feed_window};
use lkjstr_protocol::NostrEvent;
use lkjstr_relays::{ProgressiveEvent, ProgressiveReadSnapshot, ProgressiveReadStatus};

#[test]
fn gap_refill_keeps_new_rows_instead_of_a_sparse_old_tail() {
    let current = home_window_from_snapshot(
        &empty_feed_window(7, 3),
        snapshot(vec![event(1, 100), event(8, 10), event(9, 9)]),
        None,
    );
    let before = FeedWindowCursor {
        created_at: 100,
        event_id: id(1),
    };
    let next = home_window_from_snapshot(
        &current,
        snapshot(vec![event(2, 90), event(3, 80)]),
        Some(&before),
    );
    assert_eq!(next.sorted_ids, vec![id(1), id(2), id(3)]);
    assert_eq!(next.events_by_id.len(), 3);
    assert!(!next.has_newer);
}

#[test]
fn gap_refill_uses_the_full_compound_cursor_at_the_same_second() {
    let current = home_window_from_snapshot(
        &empty_feed_window(7, 3),
        snapshot(vec![event(1, 100), event(8, 100), event(9, 99)]),
        None,
    );
    let before = FeedWindowCursor {
        created_at: 100,
        event_id: id(2),
    };
    let next = home_window_from_snapshot(
        &current,
        snapshot(vec![event(3, 100), event(4, 100)]),
        Some(&before),
    );
    assert_eq!(next.sorted_ids, vec![id(1), id(3), id(4)]);
    assert!(!next.has_newer);
}

fn snapshot(events: Vec<ProgressiveEvent>) -> ProgressiveReadSnapshot {
    ProgressiveReadSnapshot {
        read_id: "gap-test".into(),
        surface: None,
        status: ProgressiveReadStatus::Complete,
        reason: "test".into(),
        events,
        relays: vec![],
        started_at_ms: 1,
        updated_at_ms: 2,
        duration_ms: 1,
        final_read: true,
    }
}

fn event(value: u64, created_at: u64) -> ProgressiveEvent {
    ProgressiveEvent {
        relays: vec!["wss://relay.example".into()],
        sub_id: "gap-test".into(),
        event: NostrEvent {
            id: id(value),
            pubkey: "a".repeat(64),
            created_at,
            kind: 1,
            tags: vec![],
            content: format!("fixture {value}"),
            sig: "b".repeat(128),
        },
    }
}

fn id(value: u64) -> String {
    format!("{value:064x}")
}
