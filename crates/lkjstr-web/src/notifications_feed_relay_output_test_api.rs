use lkjstr_app::{
    FeedFooterState, FeedViewRow, empty_feed_window, read_availability::EffectiveReadRelays,
    reduce_feed_window,
};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::{
    PageReadSurface, ProgressiveEvent, ProgressiveReadSnapshot, ProgressiveReadStatus,
};

use crate::notifications_feed_relay_input::{
    NotificationsRelayInputSeed, NotificationsRelayReadInput, NotificationsRelayReadPhase,
    notifications_older_relay_input_from_state, notifications_relay_input,
};
use crate::notifications_feed_relay_model::output_from_snapshot;

pub struct NotificationsRelayOutputProbe {
    pub footer: Option<FeedFooterState>,
    pub older_since: u64,
    pub older_until: u64,
}

pub struct NotificationsCacheCompleteProbe {
    pub visible_rows_skip_initial: bool,
    pub empty_rows_request_older: bool,
}

pub fn cache_complete_probe() -> NotificationsCacheCompleteProbe {
    NotificationsCacheCompleteProbe {
        visible_rows_skip_initial: relay_input_for_cache_complete(input()).is_none(),
        empty_rows_request_older: relay_input_for_cache_complete(NotificationsRelayReadInput {
            cache_window: empty_feed_window(1, 180),
            ..input()
        })
        .is_some_and(|input| {
            matches!(
                input.phase,
                NotificationsRelayReadPhase::Older {
                    cursor_created_at: 1_940
                }
            )
        }),
    }
}

pub fn initial_complete_output_probe() -> Option<NotificationsRelayOutputProbe> {
    let output = output_from_snapshot(
        &input(),
        snapshot(ProgressiveReadStatus::Complete, vec![progressive(2_000)]),
    );
    output_probe(output)
}

pub fn initial_complete_empty_output_probe() -> Option<NotificationsRelayOutputProbe> {
    output_probe(output_from_snapshot(
        &input(),
        snapshot(ProgressiveReadStatus::Complete, Vec::new()),
    ))
}

fn output_probe(
    output: crate::notifications_feed_relay_model::NotificationsRelayReadOutput,
) -> Option<NotificationsRelayOutputProbe> {
    let older = notifications_older_relay_input_from_state(&output.input)?;
    Some(NotificationsRelayOutputProbe {
        footer: footer_state(output.model),
        older_since: older.since,
        older_until: older.until,
    })
}

fn relay_input_for_cache_complete(
    input: NotificationsRelayReadInput,
) -> Option<NotificationsRelayReadInput> {
    let source_state = lkjstr_app::NotificationsFeedSourceState::CacheComplete;
    let active_pubkey = Some(input.active_pubkey.clone());
    notifications_relay_input(NotificationsRelayInputSeed {
        owner: &input.owner,
        active_pubkey: &active_pubkey,
        source_state: &source_state,
        read_plan: &input.read_plan,
        selected_relays: &input.selected_relays,
        window: &input.cache_window,
        notification_rows: &input.notification_rows,
        geometry_models: &input.geometry_models,
        diagnostics: &input.diagnostics,
        now_sec: input.now_sec,
        since: input.since,
        until: input.until,
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
        read_plan: read_plan(),
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
        geometry_models: Vec::new(),
        diagnostics: Vec::new(),
        now_sec: 2_100,
        since: 1_940,
        until: 2_120,
        phase: NotificationsRelayReadPhase::Initial,
    }
}

fn read_plan() -> EffectiveReadRelays {
    EffectiveReadRelays::from_durable_settings(vec!["wss://selected.example".to_owned()])
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
