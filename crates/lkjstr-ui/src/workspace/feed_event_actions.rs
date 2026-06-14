use leptos::prelude::*;

use crate::workspace::author_context_actions::AuthorContextActions;
use crate::workspace::user_timeline_actions::UserTimelineActions;

#[derive(Clone, Default)]
pub(crate) struct FeedEventActions {
    open_profile: Option<Callback<String>>,
    open_thread: Option<Callback<String>>,
    open_author_context: Option<Callback<(String, String)>>,
}

#[derive(Clone, Copy)]
pub(crate) struct FeedEventActionLabels {
    pub(crate) profile_test_id: &'static str,
    pub(crate) profile_label: &'static str,
    pub(crate) thread_test_id: &'static str,
    pub(crate) thread_label: &'static str,
    pub(crate) author_context_test_id: &'static str,
    pub(crate) author_context_label: &'static str,
}

pub(crate) fn event_actions(
    event_id: String,
    pubkey: String,
    actions: FeedEventActions,
    labels: FeedEventActionLabels,
) -> impl IntoView {
    view! {
        <div class="lkjstr-feed-actions">
            {string_button(
                pubkey.clone(),
                actions.open_profile,
                labels.profile_test_id,
                labels.profile_label,
            )}
            {string_button(
                event_id.clone(),
                actions.open_thread,
                labels.thread_test_id,
                labels.thread_label,
            )}
            {author_context_button(
                event_id,
                pubkey,
                actions.open_author_context,
                labels.author_context_test_id,
                labels.author_context_label,
            )}
        </div>
    }
}

impl From<AuthorContextActions> for FeedEventActions {
    fn from(actions: AuthorContextActions) -> Self {
        Self {
            open_profile: actions.open_profile,
            open_thread: actions.open_thread,
            open_author_context: actions.open_author_context,
        }
    }
}

impl From<UserTimelineActions> for FeedEventActions {
    fn from(actions: UserTimelineActions) -> Self {
        Self {
            open_profile: actions.open_profile,
            open_thread: actions.open_thread,
            open_author_context: actions.open_author_context,
        }
    }
}

fn string_button(
    value: String,
    action: Option<Callback<String>>,
    test_id: &'static str,
    label: &'static str,
) -> impl IntoView {
    action.map(|action| {
        let run = move |_| action.run(value.clone());
        view! { <button type="button" data-testid=test_id on:click=run>{label}</button> }
    })
}

fn author_context_button(
    event_id: String,
    pubkey: String,
    action: Option<Callback<(String, String)>>,
    test_id: &'static str,
    label: &'static str,
) -> impl IntoView {
    action.map(|action| {
        let run = move |_| action.run((event_id.clone(), pubkey.clone()));
        view! { <button type="button" data-testid=test_id on:click=run>{label}</button> }
    })
}
