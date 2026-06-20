use leptos::{ev::MouseEvent, prelude::*};

use crate::workspace::author_context_actions::AuthorContextActions;
use crate::workspace::profile_clipboard_provider::ProfileCopyProvider;
use crate::workspace::user_timeline_actions::UserTimelineActions;

#[path = "feed_event_action_policy.rs"]
mod feed_event_action_policy;
#[path = "feed_event_copy_status.rs"]
mod feed_event_copy_status;
use feed_event_action_policy::stop_action_click;
use feed_event_copy_status::FeedEventCopyStatus;

#[derive(Clone, Default)]
pub struct FeedEventActions {
    open_profile: Option<Callback<String>>,
    open_thread: Option<Callback<String>>,
    open_author_context: Option<Callback<(String, String)>>,
    copy_event_id: Option<ProfileCopyProvider>,
}

impl FeedEventActions {
    pub(crate) fn row_actions(
        open_profile: Option<Callback<String>>,
        open_thread: Option<Callback<String>>,
        open_author_context: Option<Callback<(String, String)>>,
        copy_event_id: Option<ProfileCopyProvider>,
    ) -> Self {
        Self {
            open_profile,
            open_thread,
            open_author_context,
            copy_event_id,
        }
    }

    pub(crate) fn profile_opener(&self) -> Option<Callback<String>> {
        self.open_profile
    }

    pub(crate) fn thread_opener(&self) -> Option<Callback<String>> {
        self.open_thread
    }
}

#[derive(Clone, Copy)]
pub(crate) struct FeedEventActionLabels {
    pub(crate) profile_test_id: &'static str,
    pub(crate) profile_label: &'static str,
    pub(crate) thread_test_id: &'static str,
    pub(crate) thread_label: &'static str,
    pub(crate) author_context_test_id: &'static str,
    pub(crate) author_context_label: &'static str,
    pub(crate) copy_test_id: &'static str,
    pub(crate) copy_label: &'static str,
}

pub(crate) fn event_actions(
    event_id: String,
    pubkey: String,
    actions: FeedEventActions,
    labels: FeedEventActionLabels,
) -> impl IntoView {
    if !feed_event_actions_available(&actions) {
        return ().into_any();
    }
    let copy_status = FeedEventCopyStatus::new();
    let stop_menu_click = |event: MouseEvent| event.stop_propagation();
    view! {
        <details class="lkjstr-feed-actions event-action-zone">
            <summary aria-label="Event menu" title="Event menu" on:click=stop_menu_click>"..."</summary>
            <div class="lkjstr-feed-actions__items">
                {string_button(pubkey.clone(), actions.open_profile, labels.profile_test_id, labels.profile_label)}
                {string_button(event_id.clone(), actions.open_thread, labels.thread_test_id, labels.thread_label)}
                {author_context_button(event_id.clone(), pubkey, actions.open_author_context, labels.author_context_test_id, labels.author_context_label)}
                {copy_event_id_button(event_id, actions.copy_event_id, labels.copy_test_id, labels.copy_label, copy_status)}
                {copy_status_view(copy_status.signal())}
            </div>
        </details>
    }
    .into_any()
}

impl From<AuthorContextActions> for FeedEventActions {
    fn from(actions: AuthorContextActions) -> Self {
        Self {
            open_profile: actions.open_profile,
            open_thread: actions.open_thread,
            open_author_context: actions.open_author_context,
            copy_event_id: actions.copy_event_id,
        }
    }
}

impl From<UserTimelineActions> for FeedEventActions {
    fn from(actions: UserTimelineActions) -> Self {
        Self {
            open_profile: actions.open_profile,
            open_thread: actions.open_thread,
            open_author_context: actions.open_author_context,
            copy_event_id: actions.copy_event_id,
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
        let run = move |event| {
            stop_action_click(event);
            action.run(value.clone());
        };
        view! { <button type="button" data-testid=test_id on:click=run>{label}</button> }
    })
}

fn copy_event_id_button(
    event_id: String,
    copy: Option<ProfileCopyProvider>,
    test_id: &'static str,
    label: &'static str,
    status: FeedEventCopyStatus,
) -> impl IntoView {
    let Some(copy) = copy else {
        return ().into_any();
    };
    let copy_event = move |event| {
        stop_action_click(event);
        let status = status;
        copy.copy(
            "event id".to_owned(),
            event_id.clone(),
            Callback::new(move |result| {
                status.show(result);
            }),
        );
    };
    view! {
        <button type="button" data-testid=test_id on:click=copy_event>{label}</button>
    }
    .into_any()
}

fn copy_status_view(status: RwSignal<Option<String>>) -> impl IntoView {
    move || {
        status
            .get()
            .map(|text| view! { <small role="status">{text}</small> })
    }
}

fn feed_event_actions_available(actions: &FeedEventActions) -> bool {
    actions.open_profile.is_some()
        || actions.open_thread.is_some()
        || actions.open_author_context.is_some()
        || actions.copy_event_id.is_some()
}

fn author_context_button(
    event_id: String,
    pubkey: String,
    action: Option<Callback<(String, String)>>,
    test_id: &'static str,
    label: &'static str,
) -> impl IntoView {
    action.map(|action| {
        let run = move |event| {
            stop_action_click(event);
            action.run((event_id.clone(), pubkey.clone()));
        };
        view! { <button type="button" data-testid=test_id on:click=run>{label}</button> }
    })
}

#[cfg(test)]
#[path = "feed_event_actions_tests.rs"]
mod feed_event_actions_tests;
