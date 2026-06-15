use leptos::{ev::MouseEvent, prelude::*};
use lkjstr_app::ProfileHeaderView;

use crate::workspace::profile_clipboard_provider::ProfileCopyProvider;
use crate::workspace::profile_copy_menu::{
    ProfileCopyMenuInput, profile_copy_menu, profile_copy_status,
};
use crate::workspace::profile_edit_button::edit_profile_button;
use crate::workspace::profile_follow_button::profile_follow_action;
use crate::workspace::profile_follow_provider::ProfileFollowProvider;

pub(crate) fn profile_header(
    header: ProfileHeaderView,
    active_account_pubkey: Option<String>,
    open_followees: Option<Callback<String>>,
    open_user_timeline: Option<Callback<String>>,
    open_profile_edit: Option<Callback<()>>,
    copy_profile: Option<ProfileCopyProvider>,
    follow_profile: Option<ProfileFollowProvider>,
) -> impl IntoView {
    let ProfileHeaderView {
        pubkey,
        display_name,
        subtitle,
        npub,
        nprofile,
        follow_list_json,
        relay_sets_json,
        avatar_url,
        banner_url,
        about,
        website,
        following_label,
        following_known,
        ..
    } = header;
    let avatar_alt = display_name.clone();
    let own_profile = active_account_pubkey.as_deref() == Some(pubkey.as_str());
    let timeline_pubkey = pubkey.clone();
    let copy_status = RwSignal::new(None::<String>);
    view! {
        <header class="profile-card" data-testid="rust-profile-header">
            <div class="profile-card__banner-wrap">
                {banner_url.map(|url| view! {
                    <img class="profile-card__banner" src=url alt="" />
                })}
            </div>
            <div class="profile-card__main">
                {avatar_url.map(|url| view! {
                    <div class="profile-card__top">
                        <div class="profile-card__avatar">
                            <img class="avatar lg" src=url alt=avatar_alt />
                        </div>
                    </div>
                })}
                {profile_actions(ProfileActionInput {
                    pubkey: timeline_pubkey,
                    active_account_pubkey,
                    own_profile,
                    open_user_timeline,
                    open_profile_edit,
                    copy_profile,
                    follow_profile,
                    npub: npub.clone(),
                    nprofile,
                    follow_list_json,
                    relay_sets_json,
                    copy_status,
                })}
                <div class="profile-card__identity">
                    <h2>{display_name}</h2>
                    {following_count(following_known, following_label, pubkey, open_followees)}
                    <p>{subtitle}</p>
                    <small>{npub}</small>
                </div>
                {about.map(|text| view! { <p class="profile-card__about">{text}</p> })}
                {profile_facts(website, copy_status)}
            </div>
        </header>
    }
}

struct ProfileActionInput {
    pubkey: String,
    active_account_pubkey: Option<String>,
    own_profile: bool,
    open_user_timeline: Option<Callback<String>>,
    open_profile_edit: Option<Callback<()>>,
    copy_profile: Option<ProfileCopyProvider>,
    follow_profile: Option<ProfileFollowProvider>,
    npub: String,
    nprofile: Option<String>,
    follow_list_json: String,
    relay_sets_json: String,
    copy_status: RwSignal<Option<String>>,
}

fn profile_actions(input: ProfileActionInput) -> impl IntoView {
    let ProfileActionInput {
        pubkey,
        active_account_pubkey,
        own_profile,
        open_user_timeline,
        open_profile_edit,
        copy_profile,
        follow_profile,
        npub,
        nprofile,
        follow_list_json,
        relay_sets_json,
        copy_status,
    } = input;
    if copy_profile.is_none()
        && open_user_timeline.is_none()
        && !(own_profile && open_profile_edit.is_some())
        && (active_account_pubkey.is_none() || own_profile)
    {
        return ().into_any();
    }
    let follow_pubkey = pubkey.clone();
    view! {
        <div class="profile-card__actions">
            {profile_follow_action(active_account_pubkey, follow_pubkey, own_profile, follow_profile)}
            {profile_copy_menu(ProfileCopyMenuInput {
                pubkey,
                npub,
                nprofile,
                follow_list_json,
                relay_sets_json,
                copy: copy_profile,
                open_user_timeline,
                status: copy_status,
            })}
            {edit_profile_button(own_profile, open_profile_edit)}
        </div>
    }
    .into_any()
}

fn following_count(
    known: bool,
    label: String,
    pubkey: String,
    open_followees: Option<Callback<String>>,
) -> impl IntoView {
    if let (true, Some(open_followees)) = (known, open_followees) {
        let open = move |_event: MouseEvent| {
            open_followees.run(pubkey.clone());
        };
        view! {
            <button
                type="button"
                class="profile-card__fact-button"
                aria-label="Open following list"
                on:click=open
            >
                {label}
            </button>
        }
        .into_any()
    } else {
        view! {
            <span class="profile-card__fact-muted" role="status">
                {label}
            </span>
        }
        .into_any()
    }
}

#[cfg(test)]
fn following_count_opens(known: bool, open_followees: &Option<Callback<String>>) -> bool {
    known && open_followees.is_some()
}

fn profile_facts(website: Option<String>, copy_status: RwSignal<Option<String>>) -> impl IntoView {
    view! {
        <div class="profile-card__facts">
            {website.map(|href| view! {
                <a href=href.clone() target="_blank" rel=profile_website_link_rel()>{href.clone()}</a>
            })}
            {profile_copy_status(copy_status)}
        </div>
    }
}

fn profile_website_link_rel() -> &'static str {
    "noopener noreferrer"
}

#[cfg(test)]
#[path = "profile_header_tests.rs"]
mod profile_header_tests;
