use leptos::html::Div;
use leptos::prelude::*;
use lkjstr_app::{
    FeedEventRow, FeedViewRow, ThreadFeedStatus, ThreadFeedView, ThreadOlderLoadTrigger,
    default_thread_feed_view,
};

use crate::workspace::thread_continuation::continuation_row;
use crate::workspace::thread_footer::footer_row;
use crate::workspace::thread_older::ThreadOlderLoader;
use crate::workspace::thread_provider::ThreadFeedProvider;
use crate::workspace::thread_scroll::{install_viewport_fill_probe, older_scroll_handler};

#[component]
pub fn ThreadTab(
    owner: String,
    event_id: Option<String>,
    model: ThreadFeedView,
    provider: Option<ThreadFeedProvider>,
    open_thread: Option<Callback<String>>,
) -> impl IntoView {
    let model = RwSignal::new(model);
    let complete = Callback::new(move |next| model.set(next));
    let older_loader = provider.as_ref().map(|provider| {
        ThreadOlderLoader::new(owner.clone(), event_id.clone(), provider.clone(), complete)
    });
    let older_command = older_loader
        .as_ref()
        .map(ThreadOlderLoader::command_callback);
    let older_scroll = older_scroll_handler(older_loader.clone());
    let scroll_node = NodeRef::<Div>::new();
    install_viewport_fill_probe(scroll_node, older_loader.clone(), model);
    if let Some(provider) = provider {
        let read_lease = provider.read(owner, event_id, complete);
        let older_loader = older_loader.clone();
        on_cleanup(move || {
            read_lease.release();
            if let Some(loader) = older_loader {
                loader.release();
            }
        });
    }
    view! {
        <section class="lkjstr-thread-feed" aria-label="Thread">
            <div class="tab-scroll-track event-list__scroller">
                <div
                    class="tab-scroll-owner thread-list-scroll"
                    data-scroll-owner=""
                    node_ref=scroll_node
                    on:scroll=older_scroll
                >
                    <p class="lkjstr-feed-status">{move || thread_status_text(model.get().status)}</p>
                    <div class="lkjstr-feed-rows">
                        {move || {
                            let older_command = older_command;
                            let open_thread = open_thread;
                            model.get().view_model.rows.into_iter()
                                .map(move |row| thread_row(row, older_command, open_thread))
                                .collect_view()
                        }}
                    </div>
                </div>
            </div>
        </section>
    }
}

#[must_use]
pub fn default_thread_feed(tab_id: &str, event_id: Option<String>) -> ThreadFeedView {
    default_thread_feed_view(tab_id, event_id)
}

pub fn thread_tab_content(
    tab_id: String,
    event_id: Option<String>,
    thread_feed: Option<ThreadFeedView>,
    provider: Option<ThreadFeedProvider>,
    open_thread: Option<Callback<String>>,
) -> impl IntoView {
    let model = thread_feed.unwrap_or_else(|| default_thread_feed(&tab_id, event_id.clone()));
    view! { <ThreadTab owner=tab_id event_id=event_id model=model provider=provider open_thread=open_thread /> }
}

fn thread_row(
    row: FeedViewRow,
    older_command: Option<Callback<ThreadOlderLoadTrigger>>,
    open_thread: Option<Callback<String>>,
) -> impl IntoView {
    match row {
        FeedViewRow::Event(row) => event_row(row).into_any(),
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
        FeedViewRow::Continuation(row) => continuation_row(row, open_thread).into_any(),
        FeedViewRow::Footer(row) => footer_row(row, older_command).into_any(),
        FeedViewRow::Profile(row) => view! {
            <article class="lkjstr-feed-row profile" data-row-id=row.row_id>
                <strong>{row.display_name}</strong>
            </article>
        }
        .into_any(),
        FeedViewRow::Notification(row) => view! {
            <article class="lkjstr-feed-row notification" data-row-id=row.row_id>
                <strong>{row.notification_kind}</strong>
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

fn thread_status_text(status: ThreadFeedStatus) -> &'static str {
    match status {
        ThreadFeedStatus::MissingEventId => "Thread unavailable",
        ThreadFeedStatus::NoEnabledRelay => "No enabled relay",
        ThreadFeedStatus::Ready => "Thread ready",
        ThreadFeedStatus::Partial => "Thread partial",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn thread_status_text_names_explicit_states() {
        assert_eq!(
            thread_status_text(ThreadFeedStatus::MissingEventId),
            "Thread unavailable"
        );
        assert_eq!(
            thread_status_text(ThreadFeedStatus::Partial),
            "Thread partial"
        );
    }
}
