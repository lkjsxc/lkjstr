//! One component per view kind; `TabBody` picks it from the workspace.

mod accounts;
mod compose;
mod profile;
mod relays;
mod search;
mod simple;
mod thread;

use leptos::prelude::*;
use lkjstr_core::View;
use lkjstr_core::layout::TabId;

use super::Ui;
use super::feed::{Feed, Source};

#[component]
pub fn TabBody(tab: TabId, visible: Signal<bool>) -> impl IntoView {
    let ui = Ui::get();
    let view = Memo::new(move |_| ui.ws.with(|ws| ws.tabs.get(&tab).cloned()));
    move || {
        let Some(view) = view.get() else {
            return ().into_any();
        };
        match view {
            View::Launcher => view! { <simple::Launcher tab=tab/> }.into_any(),
            View::Welcome => view! { <simple::Welcome/> }.into_any(),
            View::Home => view! { <Feed source=Source::Home visible=visible tab=tab/> }.into_any(),
            View::Global => {
                view! { <Feed source=Source::Global visible=visible tab=tab/> }.into_any()
            }
            View::Notifications => {
                view! { <Feed source=Source::Notifications visible=visible tab=tab/> }.into_any()
            }
            View::Thread { id, relays } => {
                view! { <thread::Thread id=id relays=relays visible=visible/> }.into_any()
            }
            View::Profile { pubkey } => {
                view! { <profile::Profile pubkey=pubkey visible=visible/> }.into_any()
            }
            View::Search { query } => {
                view! { <search::Search tab=tab query=query visible=visible/> }.into_any()
            }
            View::Compose { reply_to } => {
                view! { <compose::Compose tab=tab reply_to=reply_to visible=visible/> }.into_any()
            }
            View::Relays => view! { <relays::Relays/> }.into_any(),
            View::Accounts => view! { <accounts::Accounts/> }.into_any(),
            View::Settings => view! { <simple::SettingsView/> }.into_any(),
        }
    }
}
