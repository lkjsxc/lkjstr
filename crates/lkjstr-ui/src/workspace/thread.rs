use leptos::html::Div;
use leptos::prelude::*;
use lkjstr_app::{
    FeedViewRow, ThreadFeedStatus, ThreadFeedView, ThreadOlderLoadTrigger, default_thread_feed_view,
};

use crate::workspace::feed_event_actions::FeedEventActions;
use crate::workspace::feed_event_menu::event_row_with_nearby_menu;
use crate::workspace::feed_state_row;
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
    #[prop(optional)] actions: FeedEventActions,
) -> impl IntoView {
    let model = RwSignal::new(model);
    let complete = Callback::new(move |next| model.set(next));
    let older_loader = provider
        .as_ref()
        .filter(|provider| provider.supports_older())
        .map(|provider| {
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
                            let actions = actions.clone();
                            model.get().view_model.rows.into_iter()
                                .map(move |row| {
                                    thread_row(row, older_command, open_thread, actions.clone())
                                })
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
    actions: FeedEventActions,
) -> impl IntoView {
    let model = thread_feed.unwrap_or_else(|| default_thread_feed(&tab_id, event_id.clone()));
    view! {
        <ThreadTab
            owner=tab_id
            event_id=event_id
            model=model
            provider=provider
            open_thread=open_thread
            actions=actions
        />
    }
}

fn thread_row(
    row: FeedViewRow,
    older_command: Option<Callback<ThreadOlderLoadTrigger>>,
    open_thread: Option<Callback<String>>,
    actions: FeedEventActions,
) -> impl IntoView {
    match row {
        FeedViewRow::Event(row) => event_row_with_nearby_menu(
            row,
            actions,
            "thread-open-author-context",
            "thread-copy-event-id",
        )
        .into_any(),
        FeedViewRow::Unavailable(row) => feed_state_row::unavailable(row).into_any(),
        FeedViewRow::Diagnostic(row) => feed_state_row::diagnostic(row).into_any(),
        FeedViewRow::Continuation(row) => continuation_row(row, open_thread).into_any(),
        FeedViewRow::Footer(row) => footer_row(row, older_command).into_any(),
        FeedViewRow::Profile(row) => feed_state_row::profile(row).into_any(),
        FeedViewRow::Notification(row) => feed_state_row::notification(row).into_any(),
    }
}

fn thread_status_text(status: ThreadFeedStatus) -> &'static str {
    match status {
        ThreadFeedStatus::MissingEventId => "Thread unavailable",
        ThreadFeedStatus::NoEnabledRelay => "No enabled relay",
        ThreadFeedStatus::Loading => "Thread loading",
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
            thread_status_text(ThreadFeedStatus::Loading),
            "Thread loading"
        );
        assert_eq!(
            thread_status_text(ThreadFeedStatus::Partial),
            "Thread partial"
        );
    }
}
