use leptos::{ev::MouseEvent, prelude::*};

use crate::workspace::profile_follow_provider::{ProfileFollowProvider, ProfileFollowResult};

pub(crate) fn profile_follow_action(
    active_account_pubkey: Option<String>,
    target_pubkey: String,
    own_profile: bool,
    provider: Option<ProfileFollowProvider>,
) -> impl IntoView {
    let Some(account_pubkey) = active_account_pubkey else {
        return ().into_any();
    };
    if own_profile {
        return ().into_any();
    }
    profile_follow_button(account_pubkey, target_pubkey, provider).into_any()
}

fn profile_follow_button(
    account_pubkey: String,
    target_pubkey: String,
    provider: Option<ProfileFollowProvider>,
) -> impl IntoView {
    let provider = provider.unwrap_or_else(ProfileFollowProvider::unavailable);
    let following = RwSignal::new(false);
    let busy = RwSignal::new(true);
    let status = RwSignal::new(String::new());
    load_follow_state(
        provider.clone(),
        account_pubkey.clone(),
        target_pubkey.clone(),
        following,
        busy,
        status,
    );
    let toggle = move |_event: MouseEvent| {
        if busy.get_untracked() {
            return;
        }
        let current = following.get_untracked();
        let next = !current;
        busy.set(true);
        status.set(String::new());
        provider.toggle(
            account_pubkey.clone(),
            target_pubkey.clone(),
            next,
            current,
            result_callback(following, busy, status),
        );
    };
    view! {
        <div class="profile-follow-action">
            <button
                type="button"
                aria-label="Toggle follow profile"
                disabled=move || busy.get()
                on:click=toggle
            >
                {move || follow_label(following.get())}
            </button>
            {move || profile_follow_status(status.get())}
        </div>
    }
}

fn load_follow_state(
    provider: ProfileFollowProvider,
    account_pubkey: String,
    target_pubkey: String,
    following: RwSignal<bool>,
    busy: RwSignal<bool>,
    status: RwSignal<String>,
) {
    provider.load(
        account_pubkey,
        target_pubkey,
        result_callback(following, busy, status),
    );
}

fn result_callback(
    following: RwSignal<bool>,
    busy: RwSignal<bool>,
    status: RwSignal<String>,
) -> Callback<ProfileFollowResult> {
    Callback::new(move |result: ProfileFollowResult| {
        let _unused = following.try_set(result.following);
        let _unused = status.try_set(result.status);
        let _unused = busy.try_set(false);
    })
}

fn profile_follow_status(text: String) -> Option<impl IntoView> {
    if text.is_empty() {
        None
    } else {
        Some(view! { <p role="status">{text}</p> })
    }
}

fn follow_label(following: bool) -> &'static str {
    if following { "Unfollow" } else { "Follow" }
}
