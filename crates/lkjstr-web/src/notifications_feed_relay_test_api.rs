use lkjstr_app::{
    FeedFooterState, FeedViewRow, FeedWindowEvidence, FeedWindowFlags, NotificationRelayCursor,
    empty_feed_window, read_availability::EffectiveReadRelays, reduce_feed_window,
};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::{
    PageReadSurface, ProgressiveEvent, ProgressiveReadSnapshot, ProgressiveReadStatus,
};

use crate::notifications_feed_relay::notifications_relay_plan;
use crate::notifications_feed_relay_input::{
    NotificationsRelayReadInput, NotificationsRelayReadPhase, notification_event_matches_read,
    notifications_older_relay_input,
};
use crate::notifications_feed_relay_model::model_from_snapshot;

pub struct NotificationsRelayPlanProbe {
    pub sub_id: String,
    pub since: Option<u64>,
    pub until: Option<u64>,
    pub p_tags: Option<Vec<String>>,
}

pub struct NotificationsRelayMatchProbe {
    pub accepted: bool,
    pub before_window: bool,
    pub missing_p_tag: bool,
}

pub fn older_relay_plan_probe() -> Option<NotificationsRelayPlanProbe> {
    let base = input(NotificationsRelayReadPhase::Initial, 1_940, 2_120);
    let older = notifications_older_relay_input(
        &base,
        NotificationRelayCursor {
            since: 1_880,
            until: 1_939,
        },
        1_940,
    );
    let plan = notifications_relay_plan(&older)?;
    let filter = plan.filters.first()?;

    Some(NotificationsRelayPlanProbe {
        sub_id: plan.sub_id,
        since: filter.since,
        until: filter.until,
        p_tags: filter.tags.get("p").cloned(),
    })
}

pub fn notification_match_probe() -> NotificationsRelayMatchProbe {
    let input = input(NotificationsRelayReadPhase::Initial, 1_940, 2_120);

    NotificationsRelayMatchProbe {
        accepted: notification_event_matches_read(&input, &event(2_000, true)),
        before_window: notification_event_matches_read(&input, &event(1_939, true)),
        missing_p_tag: notification_event_matches_read(&input, &event(2_000, false)),
    }
}

pub fn older_complete_empty_footer_probe() -> Option<FeedFooterState> {
    older_footer(
        older_input(2_000, 1_940, 1_999),
        ProgressiveReadStatus::Complete,
    )
}

pub fn older_incomplete_empty_footer_probe() -> Option<FeedFooterState> {
    older_footer(older_input(50, 0, 49), ProgressiveReadStatus::Incomplete)
}

fn older_footer(
    input: NotificationsRelayReadInput,
    status: ProgressiveReadStatus,
) -> Option<FeedFooterState> {
    let model = model_from_snapshot(&input, snapshot(status, Vec::new()));
    match model.view_model.rows.last() {
        Some(FeedViewRow::Footer(row)) => Some(row.state),
        _ => None,
    }
}

fn input(
    phase: NotificationsRelayReadPhase,
    since: u64,
    until: u64,
) -> NotificationsRelayReadInput {
    NotificationsRelayReadInput {
        owner: "notifications-tab".to_owned(),
        active_pubkey: pubkey("a"),
        read_plan: read_plan(),
        selected_relays: vec!["wss://selected.example".to_owned()],
        cache_window: reduce_feed_window(
            empty_feed_window(1, 180),
            FeedWindowEvidence::Events {
                generation: 1,
                events: vec![progressive(2_000)],
                flags: FeedWindowFlags::default(),
            },
        ),
        notification_rows: Vec::new(),
        geometry_models: Vec::new(),
        diagnostics: Vec::new(),
        now_sec: 2_100,
        since,
        until,
        phase,
    }
}

fn older_input(cursor_created_at: u64, since: u64, until: u64) -> NotificationsRelayReadInput {
    input(
        NotificationsRelayReadPhase::Older { cursor_created_at },
        since,
        until,
    )
}

fn read_plan() -> EffectiveReadRelays {
    EffectiveReadRelays::from_durable_settings(vec!["wss://selected.example".to_owned()])
}

fn snapshot(
    status: ProgressiveReadStatus,
    events: Vec<ProgressiveEvent>,
) -> ProgressiveReadSnapshot {
    ProgressiveReadSnapshot {
        read_id: "notifications-older".to_owned(),
        surface: Some(PageReadSurface::Notifications),
        status,
        reason: "test".to_owned(),
        events,
        relays: Vec::new(),
        started_at_ms: 1,
        updated_at_ms: 2,
        duration_ms: 1,
        final_read: matches!(
            status,
            ProgressiveReadStatus::Complete
                | ProgressiveReadStatus::Incomplete
                | ProgressiveReadStatus::Failed
                | ProgressiveReadStatus::Cancelled
        ),
    }
}

fn progressive(created_at: u64) -> ProgressiveEvent {
    ProgressiveEvent {
        relays: vec!["wss://selected.example".to_owned()],
        sub_id: "notifications".to_owned(),
        event: event(created_at, true),
    }
}

fn event(created_at: u64, target_account: bool) -> NostrEvent {
    NostrEvent {
        id: format!("{created_at:064x}"),
        pubkey: pubkey("b"),
        created_at,
        kind: KIND_TEXT_NOTE,
        tags: if target_account {
            vec![vec!["p".to_owned(), pubkey("a")]]
        } else {
            Vec::new()
        },
        content: "notification event".to_owned(),
        sig: "c".repeat(128),
    }
}

fn pubkey(value: &str) -> String {
    value.repeat(64)
}
