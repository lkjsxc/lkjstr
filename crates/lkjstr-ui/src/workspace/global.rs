use leptos::html::Div;
use leptos::prelude::*;
use lkjstr_app::{FeedViewRow, GlobalFeedStatus, GlobalFeedView};

use crate::workspace::feed_event_actions::FeedEventActions;
use crate::workspace::feed_event_menu::event_row_with_nearby_menu;
use crate::workspace::feed_state_row;
use crate::workspace::global_footer::footer_row;
use crate::workspace::global_older::GlobalOlderLoader;
use crate::workspace::global_provider::GlobalFeedProvider;
use crate::workspace::global_scroll::{install_viewport_fill_probe, older_scroll_handler};

#[component]
pub fn GlobalTab(
    owner: String,
    model: GlobalFeedView,
    provider: Option<GlobalFeedProvider>,
    #[prop(optional)] actions: FeedEventActions,
) -> impl IntoView {
    let model = RwSignal::new(model);
    let complete = Callback::new(move |next| model.set(next));
    let older_loader = provider
        .as_ref()
        .filter(|provider| provider.supports_older())
        .map(|provider| GlobalOlderLoader::new(owner.clone(), provider.clone(), complete));
    let older_command = older_loader
        .as_ref()
        .map(GlobalOlderLoader::command_callback);
    let older_scroll = older_scroll_handler(older_loader.clone());
    let scroll_node = NodeRef::<Div>::new();
    install_viewport_fill_probe(scroll_node, older_loader.clone(), model);
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
        <section class="lkjstr-global-feed" aria-label="Global">
            <div class="tab-scroll-track event-list__scroller">
                <div
                    class="tab-scroll-owner global-list-scroll"
                    data-scroll-owner=""
                    node_ref=scroll_node
                    on:scroll=older_scroll
                >
                    <p class="lkjstr-feed-status">{move || global_status_text(model.get().status)}</p>
                    <div class="lkjstr-feed-rows">
                        {move || {
                            let older_command = older_command;
                            let actions = actions.clone();
                            model
                                .get()
                                .view_model
                                .rows
                                .into_iter()
                                .map(move |row| global_row(row, older_command, actions.clone()))
                                .collect_view()
                        }}
                    </div>
                </div>
            </div>
        </section>
    }
}

#[must_use]
pub fn default_global_feed(tab_id: &str) -> GlobalFeedView {
    lkjstr_app::default_global_feed_view(tab_id)
}

fn global_row(
    row: FeedViewRow,
    older_command: Option<Callback<lkjstr_app::GlobalOlderLoadTrigger>>,
    actions: FeedEventActions,
) -> impl IntoView {
    match row {
        FeedViewRow::Event(row) => event_row_with_nearby_menu(
            row,
            actions,
            "global-open-author-context",
            "global-copy-event-id",
        )
        .into_any(),
        FeedViewRow::Unavailable(row) => feed_state_row::unavailable(row).into_any(),
        FeedViewRow::Diagnostic(row) => feed_state_row::diagnostic(row).into_any(),
        FeedViewRow::Continuation(row) => feed_state_row::plain_continuation(row).into_any(),
        FeedViewRow::Footer(row) => footer_row(row, older_command).into_any(),
        FeedViewRow::Profile(row) => feed_state_row::profile(row).into_any(),
        FeedViewRow::Notification(row) => feed_state_row::notification(row).into_any(),
    }
}

fn global_status_text(status: GlobalFeedStatus) -> &'static str {
    match status {
        GlobalFeedStatus::NoEnabledRelay => "No enabled relay",
        GlobalFeedStatus::Loading => "Global loading",
        GlobalFeedStatus::Ready => "Global ready",
        GlobalFeedStatus::Partial => "Global partial",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn global_status_text_names_explicit_states() {
        assert_eq!(global_status_text(GlobalFeedStatus::Ready), "Global ready");
        assert_eq!(
            global_status_text(GlobalFeedStatus::Loading),
            "Global loading"
        );
        assert_eq!(
            global_status_text(GlobalFeedStatus::NoEnabledRelay),
            "No enabled relay"
        );
    }
}
