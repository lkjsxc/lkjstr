use leptos::prelude::*;

use crate::workspace::author_context_actions::AuthorContextActions;
use crate::workspace::profile_clipboard_provider::{
    ProfileCopyProvider, ProfileCopyResult, ProfileCopyStatus,
};
use crate::workspace::user_timeline_actions::UserTimelineActions;

#[derive(Clone, Default)]
pub(crate) struct FeedEventActions {
    open_profile: Option<Callback<String>>,
    open_thread: Option<Callback<String>>,
    open_author_context: Option<Callback<(String, String)>>,
    copy_event_id: Option<ProfileCopyProvider>,
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
    let copy_status = RwSignal::new(None::<String>);
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
                event_id.clone(),
                pubkey,
                actions.open_author_context,
                labels.author_context_test_id,
                labels.author_context_label,
            )}
            {copy_event_id_button(
                event_id,
                actions.copy_event_id,
                labels.copy_test_id,
                labels.copy_label,
                copy_status,
            )}
            {copy_status_view(copy_status)}
        </div>
    }
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
        let run = move |_| action.run(value.clone());
        view! { <button type="button" data-testid=test_id on:click=run>{label}</button> }
    })
}

fn copy_event_id_button(
    event_id: String,
    copy: Option<ProfileCopyProvider>,
    test_id: &'static str,
    label: &'static str,
    status: RwSignal<Option<String>>,
) -> impl IntoView {
    let Some(copy) = copy else {
        return ().into_any();
    };
    let copy_event = move |_| {
        let status = status;
        copy.copy(
            "event id".to_owned(),
            event_id.clone(),
            Callback::new(move |result| {
                status.set(Some(copy_event_status_text(result)));
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

fn copy_event_status_text(result: ProfileCopyResult) -> String {
    match result.status {
        ProfileCopyStatus::Copied => format!("Copied {}", result.label),
        ProfileCopyStatus::Failed(reason) => format!("Copy failed: {reason}"),
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn copy_event_status_text_names_success_and_failure() {
        assert_eq!(
            copy_event_status_text(ProfileCopyResult::copied("event id")),
            "Copied event id"
        );
        assert_eq!(
            copy_event_status_text(ProfileCopyResult::failed("event id", "denied")),
            "Copy failed: denied"
        );
    }
}
