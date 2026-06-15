use leptos::prelude::*;
use lkjstr_app::{
    FeedViewRow, NotificationsFeedStatus, NotificationsFeedView, NotificationsOlderLoadTrigger,
    default_notifications_feed_view,
};

use crate::workspace::feed_event_actions::FeedEventActions;
use crate::workspace::feed_event_menu::event_row_with_nearby_menu;
use crate::workspace::feed_state_row;
use crate::workspace::notifications_footer::footer_row;
use crate::workspace::notifications_older::NotificationsOlderLoader;
use crate::workspace::notifications_provider::NotificationsFeedProvider;
use crate::workspace::notifications_scroll::older_scroll_handler;

#[component]
pub fn NotificationsTab(
    owner: String,
    model: NotificationsFeedView,
    provider: Option<NotificationsFeedProvider>,
    #[prop(optional)] actions: FeedEventActions,
) -> impl IntoView {
    let model = RwSignal::new(model);
    let complete = Callback::new(move |next| model.set(next));
    let older_loader = provider
        .as_ref()
        .filter(|provider| provider.supports_older())
        .map(|provider| NotificationsOlderLoader::new(owner.clone(), provider.clone(), complete));
    let older_command = older_loader
        .as_ref()
        .map(NotificationsOlderLoader::command_callback);
    let older_scroll = older_scroll_handler(older_loader.clone());
    if let Some(provider) = provider {
        let read_lease = provider.read(owner, complete);
        let older_loader = older_loader.clone();
        on_cleanup(move || {
            read_lease.release();
            if let Some(loader) = older_loader {
                loader.release();
            }
        });
    }
    view! {
        <section class="feed-tab lkjstr-notifications-feed" aria-label="Notifications">
            <div class="tab-scroll-track event-list__scroller">
                <div
                    class="tab-scroll-owner notification-list-scroll"
                    data-scroll-owner=""
                    on:scroll=older_scroll
                >
                    <p class="lkjstr-feed-status">{move || status_text(model.get().status)}</p>
                    <div class="lkjstr-feed-rows">
                        {move || {
                            let older_command = older_command;
                            let actions = actions.clone();
                            model.get().view_model.rows.into_iter()
                                .map(move |row| row_view(row, older_command, actions.clone()))
                                .collect_view()
                        }}
                    </div>
                </div>
            </div>
        </section>
    }
}

#[must_use]
pub fn default_notifications_feed(
    tab_id: &str,
    active_pubkey: Option<String>,
) -> NotificationsFeedView {
    default_notifications_feed_view(tab_id, active_pubkey)
}

fn row_view(
    row: FeedViewRow,
    older_command: Option<Callback<NotificationsOlderLoadTrigger>>,
    actions: FeedEventActions,
) -> impl IntoView {
    match row {
        FeedViewRow::Event(row) => event_row_with_nearby_menu(
            row,
            actions,
            "notifications-open-author-context",
            "notifications-copy-event-id",
        )
        .into_any(),
        FeedViewRow::Notification(row) => feed_state_row::notification(row).into_any(),
        FeedViewRow::Unavailable(row) => feed_state_row::unavailable(row).into_any(),
        FeedViewRow::Diagnostic(row) => feed_state_row::diagnostic(row).into_any(),
        FeedViewRow::Continuation(row) => feed_state_row::plain_continuation(row).into_any(),
        FeedViewRow::Footer(row) => footer_row(row, older_command).into_any(),
        FeedViewRow::Profile(row) => feed_state_row::profile(row).into_any(),
    }
}

fn status_text(status: NotificationsFeedStatus) -> &'static str {
    match status {
        NotificationsFeedStatus::NoActiveAccount => "No active account",
        NotificationsFeedStatus::NoEnabledRelay => "No enabled relay",
        NotificationsFeedStatus::Loading => "Notifications loading",
        NotificationsFeedStatus::Ready => "Notifications ready",
        NotificationsFeedStatus::Partial => "Notifications partial",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn notifications_status_text_names_explicit_states() {
        assert_eq!(
            status_text(NotificationsFeedStatus::Partial),
            "Notifications partial"
        );
        assert_eq!(
            status_text(NotificationsFeedStatus::Loading),
            "Notifications loading"
        );
        assert_eq!(
            status_text(NotificationsFeedStatus::NoEnabledRelay),
            "No enabled relay"
        );
    }
}
