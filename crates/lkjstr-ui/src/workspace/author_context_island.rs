use leptos::prelude::*;
use leptos::web_sys::HtmlElement;
use lkjstr_app::default_author_context_feed_view;

use crate::workspace::author_context::AuthorContextTab;
use crate::workspace::author_context_actions::AuthorContextActions;
use crate::workspace::author_context_provider::AuthorContextFeedProvider;

pub fn mount_author_context_island(
    parent: HtmlElement,
    owner: String,
    event_id: Option<String>,
    author_pubkey: Option<String>,
    provider: AuthorContextFeedProvider,
    actions: AuthorContextIslandActions,
) -> impl FnMut() + 'static {
    let model = default_author_context_feed_view(&owner, event_id.clone(), author_pubkey.clone());
    let actions = AuthorContextActions {
        open_profile: actions.open_profile,
        open_thread: actions.open_thread,
        open_author_context: actions.open_author_context,
    };
    let handle = leptos::mount::mount_to(parent, move || {
        view! {
            <AuthorContextTab
                owner=owner.clone()
                event_id=event_id.clone()
                author_pubkey=author_pubkey.clone()
                model=model.clone()
                provider=Some(provider.clone())
                actions=actions.clone()
            />
        }
    });
    let mut handle = Some(handle);
    move || {
        drop(handle.take());
    }
}

#[derive(Clone)]
pub struct AuthorContextIslandActions {
    pub open_profile: Option<Callback<String>>,
    pub open_thread: Option<Callback<String>>,
    pub open_author_context: Option<Callback<(String, String)>>,
}
