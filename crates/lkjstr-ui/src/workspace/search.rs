use leptos::prelude::*;
use lkjstr_app::{
    SearchFeedView, default_search_feed_view, partial_search_feed_view, pending_search_feed_view,
};

#[path = "search_run.rs"]
mod search_run;

use self::search_run::SearchRunController;
use crate::workspace::feed_event_actions::FeedEventActions;
use crate::workspace::search_older::SearchOlderLoader;
use crate::workspace::search_provider::SearchFeedProvider;
use crate::workspace::search_render::{search_row, search_status_text};
use crate::workspace::search_snapshot::SearchSnapshotHandle;

const SEARCH_PROVIDER_GAP: &str = "Rust Search provider execution is not wired yet.";

#[component]
pub fn SearchTab(
    owner: String,
    model: SearchFeedView,
    provider: Option<SearchFeedProvider>,
    snapshot: SearchSnapshotHandle,
    #[prop(optional)] actions: FeedEventActions,
) -> impl IntoView {
    let model = RwSignal::new(model);
    let query = RwSignal::new(snapshot.restored_query());
    let run_controller = SearchRunController::new();
    let complete = Callback::new(move |next| model.set(next));
    let older_loader = provider
        .clone()
        .filter(|provider| provider.supports_older())
        .map(|provider| SearchOlderLoader::new(owner.clone(), provider, complete));
    let older_command = older_loader
        .as_ref()
        .map(|loader| loader.command_callback(model));
    let input_snapshot = snapshot.clone();
    let input_query = move |event| {
        let value = event_target_value(&event);
        query.set(value.clone());
        input_snapshot.save_query(value);
    };
    let submit_owner = owner.clone();
    let submit_snapshot = snapshot.clone();
    let submit_provider = provider.clone();
    let submit_controller = run_controller.clone();
    let submit_older_loader = older_loader.clone();
    let submit = move |event: leptos::ev::SubmitEvent| {
        event.prevent_default();
        release_older(&submit_older_loader);
        let text = query.get_untracked();
        submit_snapshot.save_query(text.clone());
        let trimmed = text.trim();
        if trimmed.is_empty() {
            submit_controller.release();
            model.set(default_search_feed_view(&submit_owner));
            return;
        }
        model.set(pending_search_feed_view(&submit_owner, trimmed));
        let model = model;
        if submit_controller.run(
            submit_provider.clone(),
            submit_owner.clone(),
            trimmed.to_owned(),
            Callback::new(move |next| model.set(next)),
        ) {
            return;
        }
        model.set(partial_search_feed_view(
            &submit_owner,
            trimmed,
            SEARCH_PROVIDER_GAP,
            false,
        ));
    };
    let cleanup_controller = run_controller.clone();
    let cleanup_older_loader = older_loader.clone();
    on_cleanup(move || {
        cleanup_controller.release();
        release_older(&cleanup_older_loader);
    });

    view! {
        <section class="feed-tab lkjstr-search-feed" aria-label="Search">
            <div class="tab-scroll-track event-list__scroller">
                <div class="tab-scroll-owner search-list-scroll" data-scroll-owner="">
                    <form class="lkjstr-search-controls" on:submit=submit>
                        <input
                            type="search"
                            aria-label="Search query"
                            prop:value=move || query.get()
                            on:input=input_query
                        />
                        <button type="submit" prop:disabled=move || query.get().trim().is_empty()>
                            "Search"
                        </button>
                    </form>
                    <p class="lkjstr-feed-status">{move || search_status_text(model.get().status)}</p>
                    <div class="lkjstr-feed-rows">
                        {move || {
                            let command = older_command;
                            let actions = actions.clone();
                            model
                                .get()
                                .view_model
                                .rows
                                .into_iter()
                                .map(move |row| search_row(row, command, actions.clone()))
                                .collect_view()
                        }}
                    </div>
                </div>
            </div>
        </section>
    }
}

#[must_use]
pub fn default_search_feed(tab_id: &str) -> SearchFeedView {
    default_search_feed_view(tab_id)
}

fn release_older(loader: &Option<SearchOlderLoader>) {
    if let Some(loader) = loader {
        loader.release();
    }
}
