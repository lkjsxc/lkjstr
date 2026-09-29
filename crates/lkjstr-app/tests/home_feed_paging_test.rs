use lkjstr_app::{
    FEED_LOAD_OLDER_COMMAND, FeedViewRow, FeedWindowCursor, FeedWindowState, HomeFeedSourceState,
    HomeFeedViewInput, HomeFollowState, ProtectedAccountAvailability, build_home_feed_view,
    empty_feed_window,
    home_feed::paging::{home_event_before_cursor, home_window_from_snapshot},
};
use lkjstr_protocol::NostrEvent;
use lkjstr_relays::{ProgressiveEvent, ProgressiveReadSnapshot, ProgressiveReadStatus};
mod home_feed_paging_fixture;
use home_feed_paging_fixture::input;

#[test]
fn compound_boundary_includes_only_older_timestamp_or_larger_tied_id() {
    let before = FeedWindowCursor {
        created_at: 10,
        event_id: id(2),
    };
    for (value, time, accepted) in [
        (1, 10, false),
        (2, 10, false),
        (3, 10, true),
        (1, 9, true),
        (9, 11, false),
    ] {
        assert_eq!(
            home_event_before_cursor(&event(value, time).event, &before),
            accepted
        );
    }
}

#[test]
fn older_merge_preserves_ties_deduplication_and_relay_provenance() -> Result<(), String> {
    let initial = window(10, vec![event(1, 12), event(2, 10)]);
    let mut duplicate = event(3, 10);
    duplicate.relays = vec!["wss://b.example".to_owned()];
    let next = home_window_from_snapshot(
        &initial,
        snapshot(
            ProgressiveReadStatus::Complete,
            vec![
                event(1, 12),
                event(2, 10),
                event(3, 10),
                duplicate,
                event(4, 9),
            ],
        ),
        initial.oldest_cursor.as_ref(),
    );
    assert_eq!(next.sorted_ids, vec![id(1), id(2), id(3), id(4)]);
    assert_eq!(
        next.events_by_id
            .get(&id(3))
            .ok_or("missing merged event")?
            .relays,
        vec!["wss://a.example", "wss://b.example"]
    );
    assert_eq!(next.generation, 7);
    assert!(next.terminal && next.has_older);
    Ok(())
}

#[test]
fn older_window_moves_back_without_growing_memory_or_stalling_at_cap() {
    let initial = window(180, (200..380).map(|n| event(n, n)).collect());
    let next = home_window_from_snapshot(
        &initial,
        snapshot(
            ProgressiveReadStatus::Complete,
            (170..200).map(|n| event(n, n)).collect(),
        ),
        initial.oldest_cursor.as_ref(),
    );
    assert_eq!(next.sorted_ids.len(), 180);
    assert_eq!(next.events_by_id.len(), 180);
    assert_eq!(next.sorted_ids.first(), Some(&id(349)));
    assert_eq!(next.sorted_ids.last(), Some(&id(170)));
    assert!(next.has_newer && next.has_older);
}

#[test]
fn initial_window_keeps_newest_rows() {
    let next = window(2, vec![event(1, 1), event(2, 2), event(3, 3)]);
    assert_eq!(next.sorted_ids, vec![id(3), id(2)]);
    assert!(!next.has_newer);
    assert!(next.has_older);
}

#[test]
fn empty_or_failed_reads_preserve_cursor_without_proving_history_absent() {
    let initial = window(2, vec![event(1, 0)]);
    for status in [
        ProgressiveReadStatus::Complete,
        ProgressiveReadStatus::Incomplete,
        ProgressiveReadStatus::Failed,
        ProgressiveReadStatus::Cancelled,
    ] {
        let next = home_window_from_snapshot(
            &initial,
            snapshot(status, vec![]),
            initial.oldest_cursor.as_ref(),
        );
        assert_eq!(next.oldest_cursor, initial.oldest_cursor);
        assert_eq!(next.sorted_ids, initial.sorted_ids);
        assert!(next.has_older && next.terminal);
    }
    let pending = home_window_from_snapshot(
        &initial,
        snapshot(ProgressiveReadStatus::Partial, vec![]),
        initial.oldest_cursor.as_ref(),
    );
    assert!(!pending.terminal);
    assert!(pending.has_older);
}

#[test]
fn older_footer_requires_loaded_account_follows_cursor_and_completed_initial_read() {
    let full = window(2, vec![event(1, 10)]);
    let mut input = input(full.clone());
    assert!(older_command(input.clone()));
    input.window.terminal = false;
    assert!(!older_command(input.clone()));
    input.source_state = HomeFeedSourceState::CacheComplete;
    assert!(older_command(input.clone()));
    input.window = empty_feed_window(7, 2);
    assert!(!older_command(input.clone()));
    input.window = full;
    input.follow_state = HomeFollowState::Loading;
    assert!(!older_command(input.clone()));
    input.follow_state = HomeFollowState::MissingComplete;
    assert!(!older_command(input.clone()));
    input.follow_state = HomeFollowState::Loaded {
        follow_pubkeys: vec![],
    };
    input.account = ProtectedAccountAvailability::NoSelectedAccount;
    assert!(!older_command(input.clone()));
    input.account = ProtectedAccountAvailability::selected("a".repeat(64));
    input.selected_relays.clear();
    assert!(!older_command(input));
}

fn older_command(input: HomeFeedViewInput) -> bool {
    build_home_feed_view(input).view_model.rows.iter().any(|row| {
        matches!(row, FeedViewRow::Footer(row) if row.command.as_deref() == Some(FEED_LOAD_OLDER_COMMAND))
    })
}

fn window(max: usize, events: Vec<ProgressiveEvent>) -> FeedWindowState {
    home_window_from_snapshot(
        &empty_feed_window(7, max),
        snapshot(ProgressiveReadStatus::Complete, events),
        None,
    )
}

fn snapshot(
    status: ProgressiveReadStatus,
    events: Vec<ProgressiveEvent>,
) -> ProgressiveReadSnapshot {
    ProgressiveReadSnapshot {
        read_id: "home-test".to_owned(),
        surface: None,
        status,
        reason: "test".to_owned(),
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
        relays: vec!["wss://a.example".to_owned()],
        sub_id: "test".to_owned(),
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
