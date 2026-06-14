use leptos::prelude::*;
use leptos::web_sys::HtmlElement;
use lkjstr_app::default_followees_view;

use crate::workspace::followees::FolloweesTab;
use crate::workspace::followees_actions::FolloweesActions;
use crate::workspace::followees_provider::FolloweesProvider;

pub fn mount_followees_island(
    parent: HtmlElement,
    owner: String,
    target_pubkey: Option<String>,
    provider: FolloweesProvider,
    actions: FolloweesIslandActions,
) -> impl FnMut() + 'static {
    let model = default_followees_view(&owner, target_pubkey.clone());
    let actions = FolloweesActions {
        open_profile: actions.open_profile,
        open_user_timeline: actions.open_user_timeline,
        copy_npub: actions.copy_npub,
    };
    let handle = leptos::mount::mount_to(parent, move || {
        view! {
            <FolloweesTab
                owner=owner.clone()
                target_pubkey=target_pubkey.clone()
                model=model.clone()
                provider=Some(provider.clone())
                actions=actions.clone()
                copy_status=None
            />
        }
    });
    let mut handle = Some(handle);
    move || {
        drop(handle.take());
    }
}

#[derive(Clone)]
pub struct FolloweesIslandActions {
    pub open_profile: Option<Callback<String>>,
    pub open_user_timeline: Option<Callback<String>>,
    pub copy_npub: Option<Callback<String>>,
}
