use leptos::prelude::*;
use lkjstr_domain::{TweetDraft, empty_tweet_draft, tweet_draft_id_for_tab};

use crate::workspace::tweet_provider::{TweetProvider, TweetResult};

#[component]
pub fn TweetTab(tab_id: String, provider: Option<TweetProvider>) -> impl IntoView {
    let provider = provider.unwrap_or_else(TweetProvider::unavailable);
    let draft_id = tweet_draft_id_for_tab(&tab_id);
    let draft = RwSignal::new(empty_tweet_draft(draft_id.clone(), 0));
    let status = RwSignal::new(String::from("Loading Tweet draft"));
    run_result(draft, status, {
        let provider = provider.clone();
        let draft_id = draft_id.clone();
        move |complete| provider.load(draft_id, complete)
    });

    view! {
        <section class="data-tab form-tab tweet-tab" aria-label="Tweet">
            <label>
                "Content"
                <textarea
                    aria-label="Tweet content"
                    rows="8"
                    prop:value=move || draft.get().content
                    on:input=save_text(provider.clone(), draft, status)
                />
            </label>
            <label>
                <input
                    type="checkbox"
                    aria-label="Sensitive content"
                    prop:checked=move || draft.get().sensitive
                    on:change=save_sensitive(provider.clone(), draft, status)
                />
                "Sensitive content"
            </label>
            <Show when=move || draft.get().sensitive>
                <label>
                    "Warning reason"
                    <input
                        aria-label="Content warning reason"
                        prop:value=move || draft.get().content_warning_reason
                        on:input=save_warning(provider.clone(), draft, status)
                    />
                </label>
            </Show>
            <p class="upload-gate-hint">
                "Configure media upload in Upload Settings before attaching files."
            </p>
            <div class="tweet-tab__actions">
                <button type="button" disabled=true aria-label="Attach media">"Attach media"</button>
                <button type="button" disabled=true aria-label="Publish Tweet">"Publish"</button>
                <span>"Publishing waits for Rust signing and relay queueing."</span>
            </div>
            <p role="status">{move || status.get()}</p>
        </section>
    }
}

fn save_text(
    provider: TweetProvider,
    draft: RwSignal<TweetDraft>,
    status: RwSignal<String>,
) -> impl Fn(leptos::ev::Event) {
    move |event| {
        update_and_save(provider.clone(), draft, status, |item| {
            item.content = event_target_value(&event);
        });
    }
}

fn save_sensitive(
    provider: TweetProvider,
    draft: RwSignal<TweetDraft>,
    status: RwSignal<String>,
) -> impl Fn(leptos::ev::Event) {
    move |event| {
        update_and_save(provider.clone(), draft, status, |item| {
            item.sensitive = event_target_checked(&event);
        });
    }
}

fn save_warning(
    provider: TweetProvider,
    draft: RwSignal<TweetDraft>,
    status: RwSignal<String>,
) -> impl Fn(leptos::ev::Event) {
    move |event| {
        update_and_save(provider.clone(), draft, status, |item| {
            item.content_warning_reason = event_target_value(&event);
        });
    }
}

fn update_and_save(
    provider: TweetProvider,
    draft: RwSignal<TweetDraft>,
    status: RwSignal<String>,
    update: impl FnOnce(&mut TweetDraft),
) {
    let _unused = draft.try_update(update);
    let row = draft.get_untracked();
    run_result(draft, status, move |complete| provider.save(row, complete));
}

fn run_result(
    draft: RwSignal<TweetDraft>,
    status: RwSignal<String>,
    run: impl FnOnce(Callback<TweetResult>) + 'static,
) {
    let complete = Callback::new(move |result: TweetResult| {
        let _unused = draft.try_set(result.draft);
        let _unused = status.try_set(result.status);
    });
    run(complete);
}
