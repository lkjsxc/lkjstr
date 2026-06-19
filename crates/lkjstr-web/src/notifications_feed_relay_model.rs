use lkjstr_app::{
    FeedFragmentConfig, FeedWindowEvidence, FeedWindowFlags, NotificationsFeedDiagnosticInput,
    NotificationsFeedSourceState, NotificationsFeedView, NotificationsFeedViewInput,
    NotificationsOlderPageInput, NotificationsOlderPageOutcome, build_notifications_feed_view,
    older_notification_cursor, plan_notifications_older_page, reduce_feed_window,
};
use lkjstr_relays::{
    DemandVisibility, ProgressiveReadSnapshot, ProgressiveReadStatus,
    page_read::merge_progressive_events,
};

use crate::{
    notifications_feed_host::PAGE_SIZE,
    notifications_feed_host_diagnostics::diagnostic,
    notifications_feed_relay_input::{NotificationsRelayReadInput, NotificationsRelayReadPhase},
};

#[derive(Clone)]
pub(crate) struct NotificationsRelayReadOutput {
    pub(crate) model: NotificationsFeedView,
    pub(crate) input: NotificationsRelayReadInput,
}

#[cfg(debug_assertions)]
pub(crate) fn model_from_snapshot(
    input: &NotificationsRelayReadInput,
    snapshot: ProgressiveReadSnapshot,
) -> NotificationsFeedView {
    output_from_snapshot(input, snapshot).model
}

pub(crate) fn output_from_snapshot(
    input: &NotificationsRelayReadInput,
    snapshot: ProgressiveReadSnapshot,
) -> NotificationsRelayReadOutput {
    let source_state = source_state(&snapshot);
    let diagnostics = relay_diagnostics(input, &snapshot);
    let flags = window_flags(input, &snapshot);
    let window = reduce_feed_window(
        input.cache_window.clone(),
        FeedWindowEvidence::Snapshot {
            generation: 1,
            snapshot: snapshot.clone(),
            flags,
        },
    );
    let next_input = next_input(input, &window, &snapshot, diagnostics.clone());
    let model = build_notifications_feed_view(NotificationsFeedViewInput {
        owner: input.owner.clone(),
        active_pubkey: Some(input.active_pubkey.clone()),
        source_state,
        selected_relays: input.selected_relays.clone(),
        disabled_relays: Vec::new(),
        author_routes: Vec::new(),
        visibility: DemandVisibility::Visible,
        since: Some(input.since),
        now_sec: input.now_sec,
        page_size: PAGE_SIZE,
        window,
        notification_rows: input.notification_rows.clone(),
        width_px: 680,
        font_scale: 1.0,
        geometry_models: input.geometry_models.clone(),
        fragment_config: FeedFragmentConfig::default(),
        diagnostics,
    });
    NotificationsRelayReadOutput {
        model,
        input: next_input,
    }
}

fn window_flags(
    input: &NotificationsRelayReadInput,
    snapshot: &ProgressiveReadSnapshot,
) -> FeedWindowFlags {
    match input.phase {
        NotificationsRelayReadPhase::Initial => FeedWindowFlags {
            has_older: merged_oldest_created_at(input, snapshot).is_some(),
            ..FeedWindowFlags::default()
        },
        NotificationsRelayReadPhase::Older { cursor_created_at } => FeedWindowFlags {
            has_older: older_page_outcome(input, snapshot, cursor_created_at).has_older,
            ..FeedWindowFlags::default()
        },
    }
}

fn next_input(
    input: &NotificationsRelayReadInput,
    window: &lkjstr_app::FeedWindowState,
    snapshot: &ProgressiveReadSnapshot,
    diagnostics: Vec<NotificationsFeedDiagnosticInput>,
) -> NotificationsRelayReadInput {
    let phase = next_phase(input, snapshot);
    let (since, until) = match phase {
        NotificationsRelayReadPhase::Initial => (input.since, input.until),
        NotificationsRelayReadPhase::Older { cursor_created_at } => {
            let cursor = older_notification_cursor(cursor_created_at);
            (cursor.since, cursor.until)
        }
    };
    NotificationsRelayReadInput {
        cache_window: window.clone(),
        diagnostics,
        phase,
        since,
        until,
        ..input.clone()
    }
}

fn next_phase(
    input: &NotificationsRelayReadInput,
    snapshot: &ProgressiveReadSnapshot,
) -> NotificationsRelayReadPhase {
    match input.phase {
        NotificationsRelayReadPhase::Initial => NotificationsRelayReadPhase::Initial,
        NotificationsRelayReadPhase::Older { cursor_created_at } => {
            NotificationsRelayReadPhase::Older {
                cursor_created_at: older_page_outcome(input, snapshot, cursor_created_at)
                    .older_cursor_created_at,
            }
        }
    }
}

fn older_page_outcome(
    input: &NotificationsRelayReadInput,
    snapshot: &ProgressiveReadSnapshot,
    cursor_created_at: u64,
) -> NotificationsOlderPageOutcome {
    plan_notifications_older_page(NotificationsOlderPageInput {
        older_cursor_created_at: cursor_created_at,
        merged_oldest_created_at: merged_oldest_created_at(input, snapshot),
        local_older_records_found: false,
        incoming_records_found: !snapshot.events.is_empty(),
        relay_read_complete: snapshot.status == ProgressiveReadStatus::Complete,
    })
}

fn merged_oldest_created_at(
    input: &NotificationsRelayReadInput,
    snapshot: &ProgressiveReadSnapshot,
) -> Option<u64> {
    let current = input.cache_window.visible_events();
    merge_progressive_events(&current, &snapshot.events)
        .into_iter()
        .take(input.cache_window.max_items)
        .next_back()
        .map(|item| item.event.created_at)
}

fn source_state(snapshot: &ProgressiveReadSnapshot) -> NotificationsFeedSourceState {
    match (snapshot.status, snapshot.events.is_empty()) {
        (
            ProgressiveReadStatus::Failed
            | ProgressiveReadStatus::Cancelled
            | ProgressiveReadStatus::Incomplete,
            true,
        ) => NotificationsFeedSourceState::CachedPartial {
            reason: snapshot.reason.clone(),
            retry_available: true,
        },
        _ => NotificationsFeedSourceState::RelayProgressive,
    }
}

fn relay_diagnostics(
    input: &NotificationsRelayReadInput,
    snapshot: &ProgressiveReadSnapshot,
) -> Vec<NotificationsFeedDiagnosticInput> {
    let mut out = input.diagnostics.clone();
    out.extend(snapshot.relays.iter().filter_map(|relay| {
        relay.reason.as_ref().map(|reason| {
            diagnostic(
                &format!("relay-{}", relay.relay),
                &format!("{}: {reason}", relay.relay),
            )
        })
    }));
    out
}
