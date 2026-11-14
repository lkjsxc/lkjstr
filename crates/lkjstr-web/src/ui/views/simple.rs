//! Launcher (the `+` page), Welcome and Settings.

use leptos::prelude::*;
use lkjstr_core::layout::TabId;
use lkjstr_core::{Open, View, Workspace, launcher_choices};

use crate::runtime::Storage;
use crate::ui::keys::SHORTCUTS;
use crate::ui::{Theme, Ui};

#[component]
pub fn Launcher(tab: TabId) -> impl IntoView {
    let ui = Ui::get();
    let choices = launcher_choices();
    view! {
        <div class="page launcher">
            <h2>"Open in this tab"</h2>
            <div class="choices">
                {choices
                    .into_iter()
                    .enumerate()
                    .map(|(index, choice)| {
                        let view = choice.view.clone();
                        view! {
                            <button class="choice" on:click=move |_| ui.ws.update(|ws| ws.replace_view(tab, view.clone()))>
                                <strong>{choice.title}</strong>
                                <span class="muted">{choice.hint}</span>
                                <kbd class="corner">{(index + 1).to_string()}</kbd>
                            </button>
                        }
                    })
                    .collect_view()}
            </div>
        </div>
    }
}

#[component]
pub fn Welcome() -> impl IntoView {
    let ui = Ui::get();
    let app = ui.app;
    let storage = Memo::new(move |_| {
        app.rev.track();
        app.with(|rt| match &rt.storage {
            Storage::Opening => "Opening local storage…".to_owned(),
            Storage::Ready { loaded } => {
                format!("Local storage ready · {loaded} notes and profiles cached on this device.")
            }
            Storage::WriteFailed(reason) => {
                format!("Local storage write failed ({reason}). Event writes retry while this page is open.")
            }
            Storage::Unavailable(reason) => {
                format!("Local storage unavailable ({reason}). Nothing will persist after reload.")
            }
        })
    });
    let go = move |view: View| {
        move |_| {
            ui.open(view.clone(), Open::Here);
        }
    };
    view! {
        <div class="page prose">
            <h2>"Welcome to lkjstr"</h2>
            <p>"A Nostr client that lives in tiles. Every view, from timelines and threads to profiles, search and compose, is a tab you can split, stack, resize and move. Everything you read is cached on this device first, then refreshed from relays."</p>
            <h3>"Start"</h3>
            <div class="row-actions">
                <button on:click=go(View::Accounts)>"Sign in or create a key"</button>
                <button on:click=go(View::Global)>"Browse Global"</button>
                <button on:click=go(View::Relays)>"See relays"</button>
            </div>
            <p class="muted">{move || storage.get()}</p>
            <h3>"Keyboard"</h3>
            <table class="keys">
                {SHORTCUTS.iter().map(|(keys, what)| view! { <tr><td><kbd>{*keys}</kbd></td><td>{*what}</td></tr> }).collect_view()}
            </table>
            <h3>"Privacy"</h3>
            <p>"There is no lkjstr server. Your keys, layout and cache stay in this browser. Relays you connect to see your IP address and what you ask for."</p>
        </div>
    }
}

#[component]
pub fn SettingsView() -> impl IntoView {
    let ui = Ui::get();
    let theme = move |value: Theme, label: &'static str| {
        view! {
            <label class="radio">
                <input type="radio" name="theme" checked=move || ui.settings.get().theme == value
                    on:change=move |_| ui.settings.update(|s| s.theme = value)/>
                {label}
            </label>
        }
    };
    let size = move |value: u8, label: &'static str| {
        view! {
            <label class="radio">
                <input type="radio" name="text" checked=move || ui.settings.get().text == value
                    on:change=move |_| ui.settings.update(|s| s.text = value)/>
                {label}
            </label>
        }
    };
    let reset = move |_| {
        let signed_in = ui.app.with(|rt| rt.session.active.is_some());
        ui.ws.set(Workspace::preset(signed_in));
    };
    view! {
        <div class="page prose">
            <h2>"Settings"</h2>
            <fieldset><legend>"Theme"</legend>
                {theme(Theme::System, "Follow the system")} {theme(Theme::Light, "Light")} {theme(Theme::Dark, "Dark")}
            </fieldset>
            <fieldset><legend>"Text size"</legend>
                {size(14, "Small")} {size(16, "Medium")} {size(18, "Large")}
            </fieldset>
            <fieldset><legend>"Layout"</legend>
                <p class="muted">"Layouts save automatically on this device."</p>
                <button on:click=reset>"Reset to the default layout"</button>
            </fieldset>
        </div>
    }
}
