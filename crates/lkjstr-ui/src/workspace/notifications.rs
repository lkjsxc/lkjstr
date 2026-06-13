use leptos::prelude::*;
use lkjstr_app::{
    FeedEventRow, FeedViewRow, NotificationsFeedStatus, NotificationsFeedView,
    NotificationsOlderLoadTrigger, default_notifications_feed_view,
};

use crate::workspace::notifications_footer::footer_row;
use crate::workspace::notifications_older::NotificationsOlderLoader;
use crate::workspace::notifications_provider::NotificationsFeedProvider;
use crate::workspace::notifications_scroll::older_scroll_handler;

#[component]
pub fn NotificationsTab(
    owner: String,
    model: NotificationsFeedView,
    provider: Option<NotificationsFeedProvider>,
) -> impl IntoView {
    let model = RwSignal::new(model);
    let complete = Callback::new(move |next| model.set(next));
    let older_loader = provider
        .as_ref()
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
                            model.get().view_model.rows.into_iter()
                                .map(move |row| row_view(row, older_command))
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
) -> impl IntoView {
    match row {
        FeedViewRow::Event(row) => event_row(row).into_any(),
        FeedViewRow::Notification(row) => view! {
            <article class="lkjstr-feed-row notification" data-row-id=row.row_id>
                <strong>{row.notification_kind}</strong>
            </article>
        }
        .into_any(),
        FeedViewRow::Unavailable(row) => view! {
            <article class="lkjstr-feed-row unavailable" data-row-id=row.row_id>
                <strong>{row.reason}</strong>
                <p>{row.detail}</p>
            </article>
        }
        .into_any(),
        FeedViewRow::Diagnostic(row) => view! {
            <article class="lkjstr-feed-row diagnostic" data-row-id=row.row_id>
                <strong>{format!("{:?}", row.severity)}</strong>
                <p>{row.message}</p>
            </article>
        }
        .into_any(),
        FeedViewRow::Continuation(row) => view! {
            <article class="lkjstr-feed-row continuation" data-row-id=row.row_id>
                <strong>{format!("Continue thread ({})", row.hidden_count)}</strong>
            </article>
        }
        .into_any(),
        FeedViewRow::Footer(row) => footer_row(row, older_command).into_any(),
        FeedViewRow::Profile(row) => view! {
            <article class="lkjstr-feed-row profile" data-row-id=row.row_id>
                <strong>{row.display_name}</strong>
            </article>
        }
        .into_any(),
    }
}

fn event_row(row: FeedEventRow) -> impl IntoView {
    let event_id = row.event_id.clone();
    let row_id = row.row_id.clone();
    let created_at = row.created_at;
    let text_rows = event_text(row);
    view! {
        <article class="lkjstr-feed-row event" data-row-id=row_id data-event-id=event_id>
            <small>{format!("created {created_at}")}</small>
            {text_rows.into_iter().map(|text| view! { <p>{text}</p> }).collect_view()}
        </article>
    }
}

fn event_text(row: FeedEventRow) -> Vec<String> {
    row.visual_rows
        .into_iter()
        .filter_map(|item| match item {
            lkjstr_app::FeedVisualRow::EventFull(row) => Some(row.content),
            lkjstr_app::FeedVisualRow::EventTextSegment(row) => Some(row.text),
            lkjstr_app::FeedVisualRow::EventMediaSegment(row) => {
                Some(format!("media segment {}", row.index))
            }
            lkjstr_app::FeedVisualRow::EventReferenceSegment(row) => {
                Some(format!("reference segment {}", row.index))
            }
            lkjstr_app::FeedVisualRow::EventHeader(_)
            | lkjstr_app::FeedVisualRow::EventActions(_) => None,
        })
        .collect()
}

fn status_text(status: NotificationsFeedStatus) -> &'static str {
    match status {
        NotificationsFeedStatus::NoActiveAccount => "No active account",
        NotificationsFeedStatus::NoEnabledRelay => "No enabled relay",
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
            status_text(NotificationsFeedStatus::NoEnabledRelay),
            "No enabled relay"
        );
    }
}
