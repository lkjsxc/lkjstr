#![allow(dead_code)]
use lkjstr_app::FeedWindowCursor;
use lkjstr_protocol::{NostrEvent, NostrFilter};
use lkjstr_relays::{
    ProgressiveEvent, ProgressiveReadSnapshot, ProgressiveReadStatus, ProgressiveRelaySnapshot,
    ProgressiveRelayState,
};

pub fn cursor(value: u64, time: u64) -> FeedWindowCursor {
    FeedWindowCursor {
        created_at: time,
        event_id: format!("{value:064x}"),
    }
}

pub fn event(value: u64, time: u64, relay: &str, kind: u64) -> ProgressiveEvent {
    ProgressiveEvent {
        relays: vec![relay.into()],
        sub_id: "frontier".into(),
        event: NostrEvent {
            id: cursor(value, time).event_id,
            pubkey: "a".repeat(64),
            created_at: time,
            kind,
            tags: vec![],
            content: format!("fixture {value}"),
            sig: "b".repeat(128),
        },
    }
}

pub fn filter(kind: u64) -> NostrFilter {
    NostrFilter {
        kinds: Some(vec![kind]),
        authors: Some(vec!["a".repeat(64)]),
        ..NostrFilter::default()
    }
}

pub fn snapshot(events: Vec<ProgressiveEvent>, relays: &[String]) -> ProgressiveReadSnapshot {
    ProgressiveReadSnapshot {
        read_id: "frontier".into(),
        surface: None,
        status: ProgressiveReadStatus::Complete,
        reason: "fixture".into(),
        events,
        relays: relays
            .iter()
            .map(|relay| ProgressiveRelaySnapshot {
                relay: relay.clone(),
                state: ProgressiveRelayState::Eose,
                event_count: 0,
                final_count: 0,
                duration_ms: Some(1),
                reason: None,
            })
            .collect(),
        started_at_ms: 0,
        updated_at_ms: 1,
        duration_ms: 1,
        final_read: true,
    }
}

pub fn relays() -> Vec<String> {
    vec!["wss://dense.example".into(), "wss://sparse.example".into()]
}
