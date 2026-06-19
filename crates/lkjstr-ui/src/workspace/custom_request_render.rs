use leptos::prelude::*;
use lkjstr_app::{CustomRequestFeedStatus, CustomRequestFeedView, FeedFooterRow, FeedViewRow};

use crate::workspace::feed_event_actions::FeedEventActions;
use crate::workspace::feed_event_menu::event_row_with_nearby_menu;
use crate::workspace::feed_footer_row::plain_footer;
use crate::workspace::feed_footer_text::{FooterAuthLabel, footer_state_text};
use crate::workspace::feed_state_row;

pub(crate) fn custom_request_row(row: FeedViewRow, actions: FeedEventActions) -> impl IntoView {
    match row {
        FeedViewRow::Event(row) => event_row_with_nearby_menu(
            row,
            actions,
            "custom-request-open-author-context",
            "custom-request-copy-event-id",
        )
        .into_any(),
        FeedViewRow::Unavailable(row) => feed_state_row::unavailable(row).into_any(),
        FeedViewRow::Diagnostic(row) => feed_state_row::diagnostic(row).into_any(),
        FeedViewRow::Continuation(row) => feed_state_row::plain_continuation(row).into_any(),
        FeedViewRow::Shell(row) => feed_state_row::shell(row).into_any(),
        FeedViewRow::Footer(row) => footer_row(row).into_any(),
        FeedViewRow::Profile(row) => feed_state_row::profile(row).into_any(),
        FeedViewRow::Notification(row) => feed_state_row::notification(row).into_any(),
    }
}

pub(crate) fn custom_request_status_text(model: &CustomRequestFeedView, ran: bool) -> String {
    match model.status {
        CustomRequestFeedStatus::Idle if ran => "Run the restored request again.".to_owned(),
        CustomRequestFeedStatus::Idle => "Enter request JSON.".to_owned(),
        CustomRequestFeedStatus::Planning => "Planning Custom Request".to_owned(),
        CustomRequestFeedStatus::Ready => ready_text(model),
        CustomRequestFeedStatus::Partial => unavailable_detail(model, "custom-request-partial")
            .unwrap_or_else(|| "Custom Request partial.".to_owned()),
        CustomRequestFeedStatus::Canceled => "Custom Request canceled.".to_owned(),
        CustomRequestFeedStatus::Unavailable => {
            unavailable_detail(model, "custom-request-unavailable")
                .unwrap_or_else(|| "Custom Request unavailable.".to_owned())
        }
        CustomRequestFeedStatus::Invalid => unavailable_detail(model, "custom-request-invalid")
            .unwrap_or_else(|| "Invalid request.".to_owned()),
        CustomRequestFeedStatus::NoRelay => {
            "No enabled relay is available for this request.".to_owned()
        }
    }
}

fn footer_row(row: FeedFooterRow) -> impl IntoView {
    plain_footer(
        row.row_id,
        footer_state_text(row.state, FooterAuthLabel::Account),
    )
}

fn ready_text(model: &CustomRequestFeedView) -> String {
    format!(
        "Ready for relay read: {} relay target{}.",
        model.relays.len(),
        if model.relays.len() == 1 { "" } else { "s" }
    )
}

fn unavailable_detail(model: &CustomRequestFeedView, reason: &str) -> Option<String> {
    model.view_model.rows.iter().find_map(|row| {
        let FeedViewRow::Unavailable(item) = row else {
            return None;
        };
        (item.reason == reason).then(|| item.detail.clone())
    })
}

#[cfg(test)]
mod tests {
    use lkjstr_app::{default_custom_request_feed_view, unavailable_custom_request_feed_view};

    use super::*;

    #[test]
    fn status_text_uses_explicit_unavailable_detail() {
        let model = unavailable_custom_request_feed_view("tab", "Provider unavailable.", false);

        assert_eq!(
            custom_request_status_text(&model, true),
            "Provider unavailable."
        );
    }

    #[test]
    fn status_text_names_idle_restore_state() {
        let model = default_custom_request_feed_view("tab");

        assert_eq!(
            custom_request_status_text(&model, true),
            "Run the restored request again."
        );
    }
}
