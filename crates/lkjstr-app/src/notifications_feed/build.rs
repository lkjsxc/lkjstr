use crate::{
    EventDisplayContext, FeedFooterState, FeedStateRow, FeedViewModelInput,
    NotificationsLiveQueryInput, build_feed_view_model, diagnostic_state_row, footer_row,
    footer_row_from_window, notification_state_row, notifications_live_query_input,
    unavailable_state_row,
};

use super::{
    NotificationItemInput, NotificationsFeedSourceState, NotificationsFeedStatus,
    NotificationsFeedView, NotificationsFeedViewInput, account::active_notifications_account,
};

#[must_use]
pub fn build_notifications_feed_view(input: NotificationsFeedViewInput) -> NotificationsFeedView {
    let feed_id = notifications_feed_id(&input.owner);
    let mut state_rows = diagnostic_rows(&input);
    state_rows.extend(input.notification_rows.iter().map(notification_row));
    let (status, live_query, footer_state) = notifications_state(&input, &feed_id, &mut state_rows);
    let footer = footer_state.unwrap_or_else(|| footer_row_from_window(&feed_id, &input.window));
    let view_model = build_feed_view_model(FeedViewModelInput {
        feed_id,
        display_context: EventDisplayContext::Notification,
        window: input.window,
        width_px: input.width_px,
        font_scale: input.font_scale,
        geometry_models: input.geometry_models,
        fragment_config: input.fragment_config,
        state_rows,
        footer,
    });
    NotificationsFeedView {
        status,
        live_query,
        view_model,
    }
}

#[must_use]
pub fn notifications_feed_id(owner: &str) -> String {
    format!("notifications:{owner}")
}

fn notifications_state(
    input: &NotificationsFeedViewInput,
    feed_id: &str,
    state_rows: &mut Vec<FeedStateRow>,
) -> (
    NotificationsFeedStatus,
    Option<crate::QueryDemandInput>,
    Option<crate::FeedFooterRow>,
) {
    let account_pubkey = match active_notifications_account(input, state_rows) {
        Ok(pubkey) => pubkey,
        Err(block) => return blocked(block.status, feed_id, block.footer),
    };
    if input.selected_relays.is_empty() {
        state_rows.push(unavailable_state_row(
            "no-enabled-relay",
            "notifications",
            "Notifications need at least one enabled read relay.",
            true,
        ));
        return blocked(
            NotificationsFeedStatus::NoEnabledRelay,
            feed_id,
            FeedFooterState::ConfigurationUnavailable,
        );
    }
    ready_state(input, account_pubkey, feed_id, state_rows)
}

fn ready_state(
    input: &NotificationsFeedViewInput,
    account_pubkey: String,
    feed_id: &str,
    state_rows: &mut Vec<FeedStateRow>,
) -> (
    NotificationsFeedStatus,
    Option<crate::QueryDemandInput>,
    Option<crate::FeedFooterRow>,
) {
    let live_query = Some(notifications_live_query_input(
        NotificationsLiveQueryInput {
            owner: input.owner.clone(),
            visibility: input.visibility,
            selected_relays: input.selected_relays.clone(),
            account_pubkey,
            author_routes: input.author_routes.clone(),
            disabled_relays: input.disabled_relays.clone(),
            since: input.since,
            now_sec: input.now_sec,
            page_size: input.page_size,
        },
    ));
    match &input.source_state {
        NotificationsFeedSourceState::CacheComplete => {
            let state = if input.window.visible_events().is_empty() {
                FeedFooterState::ReadingRelays
            } else {
                FeedFooterState::CacheHit
            };
            (
                NotificationsFeedStatus::Ready,
                live_query,
                Some(footer_row(feed_id, state)),
            )
        }
        NotificationsFeedSourceState::CachedPartial {
            reason,
            retry_available,
        } => {
            state_rows.push(unavailable_state_row(
                "partial-notifications-coverage",
                "notifications",
                reason,
                *retry_available,
            ));
            (
                NotificationsFeedStatus::Partial,
                live_query,
                Some(footer_row(feed_id, FeedFooterState::Partial)),
            )
        }
        NotificationsFeedSourceState::Pending => {
            (NotificationsFeedStatus::Loading, live_query, None)
        }
        NotificationsFeedSourceState::RelayProgressive => {
            (NotificationsFeedStatus::Ready, live_query, None)
        }
    }
}

fn diagnostic_rows(input: &NotificationsFeedViewInput) -> Vec<FeedStateRow> {
    input
        .diagnostics
        .iter()
        .map(|item| diagnostic_state_row(&item.scope, &item.id, item.severity, &item.message))
        .collect()
}

fn notification_row(row: &NotificationItemInput) -> FeedStateRow {
    notification_state_row(
        &row.notification_id,
        &row.notification_kind,
        row.source_event_id.clone(),
    )
}

fn blocked(
    status: NotificationsFeedStatus,
    feed_id: &str,
    footer_state: FeedFooterState,
) -> (
    NotificationsFeedStatus,
    Option<crate::QueryDemandInput>,
    Option<crate::FeedFooterRow>,
) {
    (status, None, Some(footer_row(feed_id, footer_state)))
}
