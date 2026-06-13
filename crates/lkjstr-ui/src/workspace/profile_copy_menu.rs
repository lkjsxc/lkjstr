use leptos::{ev::MouseEvent, prelude::*};

use crate::workspace::profile_clipboard_provider::{
    ProfileCopyProvider, ProfileCopyResult, ProfileCopyStatus,
};

pub(crate) struct ProfileCopyMenuInput {
    pub(crate) pubkey: String,
    pub(crate) npub: String,
    pub(crate) nprofile: Option<String>,
    pub(crate) follow_list_json: String,
    pub(crate) relay_sets_json: String,
    pub(crate) copy: Option<ProfileCopyProvider>,
    pub(crate) open_user_timeline: Option<Callback<String>>,
    pub(crate) status: RwSignal<Option<String>>,
}

pub(crate) fn profile_copy_menu(input: ProfileCopyMenuInput) -> impl IntoView {
    let ProfileCopyMenuInput {
        pubkey,
        npub,
        nprofile,
        follow_list_json,
        relay_sets_json,
        copy,
        open_user_timeline,
        status,
    } = input;
    if copy.is_none() && open_user_timeline.is_none() {
        return ().into_any();
    }
    view! {
        <details class="profile-copy-menu">
            <summary aria-label="Profile copy menu" title="Profile copy menu">"..."</summary>
            <div class="profile-copy-menu__items">
                {copy_text_button("npub", "Copy npub", "Copy npub", npub, copy.clone(), status)}
                {copy_nprofile_button(nprofile, copy.clone(), status)}
                {copy_text_button(
                    "follow list",
                    "Copy follow list JSON",
                    "Copy follow list JSON",
                    follow_list_json,
                    copy.clone(),
                    status,
                )}
                {copy_text_button(
                    "relay sets",
                    "Copy relay sets JSON",
                    "Copy relay sets JSON",
                    relay_sets_json,
                    copy,
                    status,
                )}
                {user_timeline_button(pubkey, open_user_timeline)}
            </div>
        </details>
    }
    .into_any()
}

pub(crate) fn profile_copy_status(status: RwSignal<Option<String>>) -> impl IntoView {
    move || {
        status
            .get()
            .map(|text| view! { <span role="status">{text}</span> })
    }
}

fn copy_text_button(
    label: &'static str,
    aria_label: &'static str,
    text: &'static str,
    value: String,
    copy: Option<ProfileCopyProvider>,
    status: RwSignal<Option<String>>,
) -> impl IntoView {
    let Some(copy) = copy else {
        return ().into_any();
    };
    let copy_text = move |_event: MouseEvent| {
        let status = status;
        copy.copy(
            label.to_owned(),
            value.clone(),
            Callback::new(move |result| {
                status.set(Some(copy_status_text(result)));
            }),
        );
    };
    view! {
        <button type="button" aria-label=aria_label on:click=copy_text>
            {text}
        </button>
    }
    .into_any()
}

fn copy_nprofile_button(
    nprofile: Option<String>,
    copy: Option<ProfileCopyProvider>,
    status: RwSignal<Option<String>>,
) -> impl IntoView {
    let disabled = nprofile.is_none() || copy.is_none();
    let copy_nprofile = move |_event: MouseEvent| {
        let (Some(copy), Some(nprofile)) = (copy.clone(), nprofile.clone()) else {
            return;
        };
        copy.copy(
            "nprofile".to_owned(),
            nprofile,
            Callback::new(move |result| {
                status.set(Some(copy_status_text(result)));
            }),
        );
    };
    view! {
        <button
            type="button"
            aria-label="Copy nprofile"
            disabled=disabled
            on:click=copy_nprofile
        >
            "Copy nprofile"
        </button>
    }
}

fn user_timeline_button(
    pubkey: String,
    open_user_timeline: Option<Callback<String>>,
) -> impl IntoView {
    let Some(open_user_timeline) = open_user_timeline else {
        return ().into_any();
    };
    let open = move |_event: MouseEvent| {
        open_user_timeline.run(pubkey.clone());
    };
    view! {
        <button type="button" aria-label="Open user timeline" on:click=open>
            "Open user timeline"
        </button>
    }
    .into_any()
}

fn copy_status_text(result: ProfileCopyResult) -> String {
    match result.status {
        ProfileCopyStatus::Copied => format!("Copied {}", result.label),
        ProfileCopyStatus::Failed(reason) => format!("Copy failed: {reason}"),
    }
}
