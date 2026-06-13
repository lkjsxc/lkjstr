use lkjstr_app::{FeedFooterState, FeedViewRow, empty_feed_window, reduce_feed_window};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::{
    PageReadSurface, ProgressiveEvent, ProgressiveReadSnapshot, ProgressiveReadStatus,
};

use crate::notifications_feed_relay_input::{
    NotificationsRelayReadInput, NotificationsRelayReadPhase,
    notifications_older_relay_input_from_state,
};
use crate::notifications_feed_relay_model::output_from_snapshot;

pub struct NotificationsRelayOutputProbe {
    pub footer: Option<FeedFooterState>,
    pub older_since: u64,
    pub older_until: u64,
}

pub fn initial_complete_output_probe() -> Option<NotificationsRelayOutputProbe> {
    let output = output_from_snapshot(
        &input(),
        snapshot(ProgressiveReadStatus::Complete, vec![progressive(2_000)]),
    );
    let older = notifications_older_relay_input_from_state(&output.input)?;
    Some(NotificationsRelayOutputProbe {
        footer: footer_state(output.model),
        older_since: older.since,
        older_until: older.until,
    })
}

fn footer_state(model: lkjstr_app::NotificationsFeedView) -> Option<FeedFooterState> {
    match model.view_model.rows.last() {
        Some(FeedViewRow::Footer(row)) => Some(row.state),
        _ => None,
    }
}

fn input() -> NotificationsRelayReadInput {
    NotificationsRelayReadInput {
        owner: "notifications-tab".to_owned(),
        active_pubkey: pubkey("a"),
        selected_relays: vec!["wss://selected.example".to_owned()],
        cache_window: reduce_feed_window(
            empty_feed_window(1, 180),
            lkjstr_app::FeedWindowEvidence::Events {
                generation: 1,
                events: vec![progressive(2_000)],
                flags: lkjstr_app::FeedWindowFlags::default(),
            },
        ),
        notification_rows: Vec::new(),
        diagnostics: Vec::new(),
        now_sec: 2_100,
        since: 1_940,
        until: 2_120,
        phase: NotificationsRelayReadPhase::Initial,
    }
}

fn snapshot(
    status: ProgressiveReadStatus,
    events: Vec<ProgressiveEvent>,
) -> ProgressiveReadSnapshot {
    ProgressiveReadSnapshot {
        read_id: "notifications-initial".to_owned(),
        surface: Some(PageReadSurface::Notifications),
        status,
        reason: "test".to_owned(),
        events,
        relays: Vec::new(),
        started_at_ms: 1,
        updated_at_ms: 2,
        duration_ms: 1,
        final_read: true,
    }
}

fn progressive(created_at: u64) -> ProgressiveEvent {
    ProgressiveEvent {
        relays: vec!["wss://selected.example".to_owned()],
        sub_id: "notifications".to_owned(),
        event: event(created_at),
    }
}

fn event(created_at: u64) -> NostrEvent {
    NostrEvent {
        id: format!("{created_at:064x}"),
        pubkey: pubkey("b"),
        created_at,
        kind: KIND_TEXT_NOTE,
        tags: vec![vec!["p".to_owned(), pubkey("a")]],
        content: "notification event".to_owned(),
        sig: "c".repeat(128),
    }
}

fn pubkey(value: &str) -> String {
    value.repeat(64)
}
