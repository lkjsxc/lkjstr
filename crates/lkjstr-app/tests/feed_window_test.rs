use lkjstr_app::{
    FeedWindowEvidence, FeedWindowFlags, FeedWindowStatus, empty_feed_window,
    feed_window_empty_ready, reduce_feed_window,
};
use lkjstr_protocol::NostrEvent;
use lkjstr_relays::{ProgressiveEvent, ProgressiveReadSnapshot, ProgressiveReadStatus};

#[test]
fn events_merge_sort_dedupe_and_derive_cursors() -> Result<(), String> {
    let state = empty_feed_window(7, 10);
    let state = reduce_feed_window(
        state,
        FeedWindowEvidence::Events {
            generation: 7,
            events: vec![
                progressive(1, 10, "wss://relay-a.example"),
                progressive(2, 20, "wss://relay-a.example"),
                progressive(2, 20, "wss://relay-b.example"),
                progressive(3, 15, "wss://relay-c.example"),
            ],
            flags: FeedWindowFlags {
                has_older: true,
                ..FeedWindowFlags::default()
            },
        },
    );

    assert_eq!(state.sorted_ids, vec![id(2), id(3), id(1)]);
    assert_eq!(cursor_id(state.newest_cursor.as_ref())?, id(2));
    assert_eq!(cursor_id(state.oldest_cursor.as_ref())?, id(1));
    assert_eq!(
        state.events_by_id.get(&id(2)).map(|item| &item.relays),
        Some(&vec![
            "wss://relay-a.example".to_owned(),
            "wss://relay-b.example".to_owned(),
        ])
    );
    assert!(state.has_older);
    assert_eq!(
        feed_window_empty_ready(&state),
        FeedWindowStatus::PendingWithRows
    );
    Ok(())
}

#[test]
fn window_cap_keeps_newest_rows_and_marks_older_available() -> Result<(), String> {
    let state = reduce_feed_window(
        empty_feed_window(1, 2),
        FeedWindowEvidence::Events {
            generation: 1,
            events: vec![
                progressive(1, 10, "wss://relay-a.example"),
                progressive(2, 30, "wss://relay-a.example"),
                progressive(3, 20, "wss://relay-a.example"),
            ],
            flags: FeedWindowFlags::default(),
        },
    );

    assert_eq!(state.sorted_ids, vec![id(2), id(3)]);
    assert_eq!(cursor_id(state.oldest_cursor.as_ref())?, id(3));
    assert!(state.has_older);
    assert!(!state.events_by_id.contains_key(&id(1)));
    Ok(())
}

#[test]
fn stale_generation_evidence_is_ignored() {
    let state = reduce_feed_window(
        empty_feed_window(2, 10),
        FeedWindowEvidence::Events {
            generation: 2,
            events: vec![progressive(1, 10, "wss://relay-a.example")],
            flags: FeedWindowFlags::default(),
        },
    );
    let stale = reduce_feed_window(
        state.clone(),
        FeedWindowEvidence::Events {
            generation: 1,
            events: vec![progressive(2, 20, "wss://relay-b.example")],
            flags: FeedWindowFlags {
                terminal: true,
                ..FeedWindowFlags::default()
            },
        },
    );

    assert_eq!(stale, state);
}

#[test]
fn empty_state_is_ready_only_after_terminal_snapshot() {
    let pending = reduce_feed_window(
        empty_feed_window(9, 10),
        FeedWindowEvidence::Snapshot {
            generation: 9,
            snapshot: snapshot(ProgressiveReadStatus::Partial, false, Vec::new()),
            flags: FeedWindowFlags::default(),
        },
    );
    let terminal = reduce_feed_window(
        pending.clone(),
        FeedWindowEvidence::Snapshot {
            generation: 9,
            snapshot: snapshot(ProgressiveReadStatus::Complete, true, Vec::new()),
            flags: FeedWindowFlags::default(),
        },
    );

    assert_eq!(
        feed_window_empty_ready(&pending),
        FeedWindowStatus::PendingEmpty
    );
    assert_eq!(
        feed_window_empty_ready(&terminal),
        FeedWindowStatus::TerminalEmpty
    );
}

#[test]
fn reset_advances_generation_and_clears_window() {
    let state = reduce_feed_window(
        empty_feed_window(1, 10),
        FeedWindowEvidence::Events {
            generation: 1,
            events: vec![progressive(1, 10, "wss://relay-a.example")],
            flags: FeedWindowFlags {
                terminal: true,
                ..FeedWindowFlags::default()
            },
        },
    );
    let reset = reduce_feed_window(state, FeedWindowEvidence::Reset { generation: 2 });

    assert_eq!(reset.generation, 2);
    assert!(reset.sorted_ids.is_empty());
    assert_eq!(
        feed_window_empty_ready(&reset),
        FeedWindowStatus::PendingEmpty
    );
}

fn cursor_id(cursor: Option<&lkjstr_app::FeedWindowCursor>) -> Result<String, String> {
    cursor
        .map(|cursor| cursor.event_id.clone())
        .ok_or_else(|| "missing cursor".to_owned())
}

fn snapshot(
    status: ProgressiveReadStatus,
    final_read: bool,
    events: Vec<ProgressiveEvent>,
) -> ProgressiveReadSnapshot {
    ProgressiveReadSnapshot {
        read_id: "read-a".to_owned(),
        surface: None,
        status,
        reason: "test".to_owned(),
        events,
        relays: Vec::new(),
        started_at_ms: 1,
        updated_at_ms: 2,
        duration_ms: 1,
        final_read,
    }
}

fn progressive(value: u64, created_at: u64, relay: &str) -> ProgressiveEvent {
    ProgressiveEvent {
        relays: vec![relay.to_owned()],
        sub_id: "sub-a".to_owned(),
        event: NostrEvent {
            id: id(value),
            pubkey: "a".repeat(64),
            created_at,
            kind: 1,
            tags: Vec::new(),
            content: format!("event {value}"),
            sig: "b".repeat(128),
        },
    }
}

fn id(value: u64) -> String {
    format!("{value:064x}")
}
