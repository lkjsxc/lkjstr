use lkjstr_protocol::NostrEvent;
use lkjstr_relays::{
    InitialProgressiveRead, ProgressiveEvent, ProgressiveReadEvidence, ProgressiveReadStatus,
    ProgressiveRelayState, ReadPageRelayStatus, event_relays, initial_progressive_read,
    progressive_read_snapshot, reduce_progressive_read,
};

#[test]
fn reducer_moves_from_idle_through_partial_to_complete() {
    let mut state = initial_progressive_read(InitialProgressiveRead {
        read_id: "read-1".to_owned(),
        surface: None,
        relays: vec!["wss://a.example/".to_owned(), "wss://b.example/".to_owned()],
        started_at_ms: 1,
    });
    assert_eq!(state.status, ProgressiveReadStatus::Idle);

    state = reduce_progressive_read(
        state,
        ProgressiveReadEvidence::RelayEvents(vec![pool_event(
            "wss://a.example/",
            &"b".repeat(64),
            20,
        )]),
    );
    assert_eq!(state.status, ProgressiveReadStatus::Partial);

    state = reduce_progressive_read(
        state,
        ProgressiveReadEvidence::Finalize(vec![
            status("wss://a.example/", StatusPatch::eose(1)),
            status("wss://b.example/", StatusPatch::eose(0)),
        ]),
    );
    let snapshot = progressive_read_snapshot(&state, "final", 10);
    assert_eq!(snapshot.status, ProgressiveReadStatus::Complete);
    assert!(snapshot.final_read);
}

#[test]
fn reducer_merges_duplicate_event_provenance_in_order() {
    let id = "c".repeat(64);
    let state = reduce_progressive_read(
        initial_progressive_read(InitialProgressiveRead {
            read_id: "read-2".to_owned(),
            surface: None,
            relays: vec!["wss://a.example/".to_owned(), "wss://b.example/".to_owned()],
            started_at_ms: 1,
        }),
        ProgressiveReadEvidence::RelayEvents(vec![
            pool_event("wss://a.example/", &id, 10),
            pool_event("wss://b.example/", &id, 10),
            pool_event("wss://b.example/", &"a".repeat(64), 11),
        ]),
    );

    assert_eq!(
        state
            .events
            .iter()
            .map(|item| item.event.id.clone())
            .collect::<Vec<_>>(),
        vec!["a".repeat(64), id.clone()]
    );
    assert_eq!(
        event_relays(&state.events, &id),
        vec!["wss://a.example/".to_owned(), "wss://b.example/".to_owned()]
    );
}

#[test]
fn timeout_is_incomplete_and_cancel_ignores_late_events() {
    let mut state = initial_progressive_read(InitialProgressiveRead {
        read_id: "read-3".to_owned(),
        surface: None,
        relays: vec!["wss://a.example/".to_owned()],
        started_at_ms: 1,
    });
    state = reduce_progressive_read(
        state,
        ProgressiveReadEvidence::RelayEvents(vec![pool_event(
            "wss://a.example/",
            &"d".repeat(64),
            1,
        )]),
    );
    state = reduce_progressive_read(
        state,
        ProgressiveReadEvidence::Finalize(vec![status(
            "wss://a.example/",
            StatusPatch::timeout(1),
        )]),
    );
    assert_eq!(state.status, ProgressiveReadStatus::Incomplete);

    let cancelled = reduce_progressive_read(state, ProgressiveReadEvidence::Cancel);
    let after = reduce_progressive_read(
        cancelled,
        ProgressiveReadEvidence::RelayEvents(vec![pool_event(
            "wss://a.example/",
            &"e".repeat(64),
            2,
        )]),
    );
    assert_eq!(after.status, ProgressiveReadStatus::Cancelled);
    assert_eq!(after.events.len(), 1);
}

#[test]
fn relay_status_flags_map_to_snapshot_states() {
    let state = reduce_progressive_read(
        initial_progressive_read(InitialProgressiveRead {
            read_id: "read-4".to_owned(),
            surface: None,
            relays: vec!["wss://a.example/".to_owned()],
            started_at_ms: 1,
        }),
        ProgressiveReadEvidence::RelayStatuses(vec![status(
            "wss://a.example/",
            StatusPatch::auth(),
        )]),
    );

    assert_eq!(
        state
            .relay_states
            .get("wss://a.example/")
            .map(|item| item.state),
        Some(ProgressiveRelayState::Auth)
    );
}

fn pool_event(relay: &str, id: &str, created_at: u64) -> ProgressiveEvent {
    ProgressiveEvent {
        relays: vec![relay.to_owned()],
        sub_id: "sub".to_owned(),
        event: NostrEvent {
            id: id.to_owned(),
            pubkey: "f".repeat(64),
            created_at,
            kind: 1,
            tags: Vec::new(),
            content: id.to_owned(),
            sig: "0".repeat(128),
        },
    }
}

fn status(relay: &str, patch: StatusPatch) -> ReadPageRelayStatus {
    ReadPageRelayStatus {
        relay: relay.to_owned(),
        eose: patch.eose,
        timeout: patch.timeout,
        closed: false,
        auth: patch.auth,
        socket_closed: false,
        socket_error: false,
        event_limit_reached: false,
        aborted: false,
        duration_ms: 1,
        candidate_count: patch.final_count,
        final_count: patch.final_count,
    }
}

#[derive(Clone, Copy)]
struct StatusPatch {
    eose: bool,
    timeout: bool,
    auth: bool,
    final_count: u64,
}

impl StatusPatch {
    const fn eose(final_count: u64) -> Self {
        Self {
            eose: true,
            timeout: false,
            auth: false,
            final_count,
        }
    }
    const fn timeout(final_count: u64) -> Self {
        Self {
            eose: false,
            timeout: true,
            auth: false,
            final_count,
        }
    }

    const fn auth() -> Self {
        Self {
            eose: false,
            timeout: false,
            auth: true,
            final_count: 0,
        }
    }
}
