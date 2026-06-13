use lkjstr_relays::ProgressiveEvent;

use crate::{
    events::{EventDisplayContext, EventDisplayInput, plan_event_display},
    feed::{FeedWindowState, feed_window_empty_ready},
    feed_fragments::{FeedFragmentConfig, SemanticFeedEvent, plan_feed_visual_rows},
    feed_geometry::{
        MaterializationTier, RowGeometryModel, RowKind, estimate_row_geometry,
        event_geometry_features,
    },
};

use super::{
    FEED_LOAD_OLDER_COMMAND, FeedDiagnosticRow, FeedDiagnosticSeverity, FeedFooterRow,
    FeedFooterState, FeedNotificationRow, FeedProfileRow, FeedStateRow, FeedUnavailableRow,
    FeedViewModel, FeedViewRow, feed_diagnostic_row_id, feed_event_row_id, feed_footer_row_id,
    feed_notification_row_id, feed_profile_row_id, feed_unavailable_row_id,
};

#[derive(Clone, Debug)]
pub struct FeedViewModelInput {
    pub feed_id: String,
    pub display_context: EventDisplayContext,
    pub window: FeedWindowState,
    pub width_px: u16,
    pub font_scale: f32,
    pub geometry_models: Vec<RowGeometryModel>,
    pub fragment_config: FeedFragmentConfig,
    pub state_rows: Vec<FeedStateRow>,
    pub footer: FeedFooterRow,
}

#[must_use]
pub fn build_feed_view_model(input: FeedViewModelInput) -> FeedViewModel {
    let mut rows = input
        .window
        .visible_events()
        .iter()
        .map(|event| {
            FeedViewRow::Event(event_row(
                event,
                input.display_context,
                input.width_px,
                input.font_scale,
                &input.geometry_models,
                &input.fragment_config,
            ))
        })
        .collect::<Vec<_>>();
    rows.extend(input.state_rows.into_iter().map(FeedViewRow::from));
    rows.push(FeedViewRow::Footer(input.footer));
    FeedViewModel {
        feed_id: input.feed_id,
        rows,
    }
}

#[must_use]
pub fn footer_row(feed_id: &str, state: FeedFooterState) -> FeedFooterRow {
    let command = matches!(state, FeedFooterState::OlderLoadReady)
        .then(|| FEED_LOAD_OLDER_COMMAND.to_owned());
    FeedFooterRow {
        row_id: feed_footer_row_id(feed_id),
        feed_id: feed_id.to_owned(),
        state,
        command,
        disabled_reason: None,
        diagnostic_id: None,
    }
}

#[must_use]
pub fn footer_row_from_window(feed_id: &str, window: &FeedWindowState) -> FeedFooterRow {
    let state = match feed_window_empty_ready(window) {
        crate::FeedWindowStatus::PendingEmpty => FeedFooterState::Loading,
        crate::FeedWindowStatus::PendingWithRows => FeedFooterState::ReadingRelays,
        crate::FeedWindowStatus::TerminalEmpty => FeedFooterState::TerminalEmpty,
        crate::FeedWindowStatus::TerminalWithRows if window.has_older => {
            FeedFooterState::OlderLoadReady
        }
        crate::FeedWindowStatus::TerminalWithRows => FeedFooterState::TerminalWithRows,
    };
    footer_row(feed_id, state)
}

#[must_use]
pub fn profile_state_row(pubkey: &str, display_name: &str) -> FeedStateRow {
    FeedStateRow::Profile(FeedProfileRow {
        row_id: feed_profile_row_id(pubkey),
        pubkey: pubkey.to_owned(),
        display_name: display_name.to_owned(),
    })
}

#[must_use]
pub fn notification_state_row(
    event_id: &str,
    notification_kind: &str,
    source_event_id: Option<String>,
) -> FeedStateRow {
    FeedStateRow::Notification(FeedNotificationRow {
        row_id: feed_notification_row_id(event_id, notification_kind),
        event_id: event_id.to_owned(),
        notification_kind: notification_kind.to_owned(),
        source_event_id,
    })
}

#[must_use]
pub fn unavailable_state_row(
    reason: &str,
    subject: &str,
    detail: &str,
    retry_available: bool,
) -> FeedStateRow {
    FeedStateRow::Unavailable(FeedUnavailableRow {
        row_id: feed_unavailable_row_id(reason, subject),
        reason: reason.to_owned(),
        subject: subject.to_owned(),
        detail: detail.to_owned(),
        retry_available,
    })
}

#[must_use]
pub fn diagnostic_state_row(
    scope: &str,
    id: &str,
    severity: FeedDiagnosticSeverity,
    message: &str,
) -> FeedStateRow {
    FeedStateRow::Diagnostic(FeedDiagnosticRow {
        row_id: feed_diagnostic_row_id(scope, id),
        scope: scope.to_owned(),
        diagnostic_id: id.to_owned(),
        severity,
        message: message.to_owned(),
    })
}

fn event_row(
    event: &ProgressiveEvent,
    context: EventDisplayContext,
    width_px: u16,
    font_scale: f32,
    models: &[RowGeometryModel],
    config: &FeedFragmentConfig,
) -> super::FeedEventRow {
    let display = plan_event_display(&EventDisplayInput {
        event_id: Some(event.event.id.clone()),
        event_kind: Some(event.event.kind),
        content_shape_hash: None,
        context,
        target_available: true,
    });
    let features = event_geometry_features(
        &event.event,
        RowKind::Event,
        width_px,
        font_scale,
        false,
        display.chrome.show_actions,
        MaterializationTier::Enriched,
    );
    let row_id = feed_event_row_id(&event.event.id);
    let geometry_estimate = estimate_row_geometry(row_id.clone(), &features, models);
    let semantic = SemanticFeedEvent {
        event_id: event.event.id.clone(),
        event_kind: event.event.kind,
        pubkey: event.event.pubkey.clone(),
        created_at: event.event.created_at,
        content: event.event.content.clone(),
        media_count: features.media_count,
        reference_count: features.reference_preview_count,
        relay_provenance: event.relays.clone(),
        has_action_bar: display.chrome.show_actions,
    };
    super::FeedEventRow {
        row_id,
        event_id: event.event.id.clone(),
        author_pubkey: event.event.pubkey.clone(),
        created_at: event.event.created_at,
        event_kind: event.event.kind,
        relay_provenance: event.relays.clone(),
        visual_rows: plan_feed_visual_rows(
            &semantic,
            &features.content_shape_hash,
            geometry_estimate.estimated_height_px,
            config,
        ),
        geometry_estimate,
        display,
        has_content_warning: features.has_content_warning,
        custom_emoji_count: features.custom_emoji_count,
    }
}
