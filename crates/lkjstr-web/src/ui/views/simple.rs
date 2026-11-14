//! Launcher (the `+` page), Welcome and Settings.

use leptos::prelude::*;
use lkjstr_core::layout::TabId;
use lkjstr_core::{Open, View, launcher_choices};

use crate::runtime::Storage;
use crate::ui::{Theme, Ui};

#[component]
pub fn Launcher(tab: TabId) -> impl IntoView {
    let ui = Ui::get();
    let choices = launcher_choices();
    view! {
        <div class="page launcher">
            <h2>{move || ui.tr("Open in this tab")}</h2>
            <div class="choices">
                {choices
                    .into_iter()
                    .enumerate()
                    .map(|(index, choice)| {
                        let view = choice.view.clone();
                        view! {
                            <button class="choice" on:click=move |_| ui.ws.update(|ws| ws.replace_view(tab, view.clone()))>
                                <strong>{ui.tr(choice.title)}</strong>
                                <span class="muted">{ui.tr(choice.hint)}</span>
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
            <h2>{move || ui.tr("Welcome to lkjstr")}</h2>
            <p>"A Nostr client that lives in tiles. Every view, from timelines and threads to profiles, search and compose, is a tab you can split, stack, resize and move. Everything you read is cached on this device first, then refreshed from relays."</p>
            <h3>{move || ui.tr("Start")}</h3>
            <div class="row-actions">
                <button on:click=go(View::Accounts)>{move || ui.tr("Sign in or create a key")}</button>
                <button on:click=go(View::Global)>{move || ui.tr("Browse Global")}</button>
                <button on:click=go(View::Relays)>{move || ui.tr("See relays")}</button>
            </div>
            <div class="storage-state">
                <p class="muted" role="status">{move || storage.get()}</p>
                <Show when=move || { app.rev.track(); app.with(|rt| matches!(rt.storage, Storage::Unavailable(_))) }>
                    <button on:click=move |_| { if let Some(window) = web_sys::window() { let _ = window.location().reload(); } }>"Retry storage"</button>
                </Show>
            </div>
            <h3>{move || ui.tr("Privacy")}</h3>
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
                {move || ui.tr(label)}
            </label>
        }
    };
    let size = move |value: u8, label: &'static str| {
        view! {
            <label class="radio">
                <input type="radio" name="text" checked=move || ui.settings.get().text == value
                    on:change=move |_| ui.settings.update(|s| s.text = value)/>
                {move || ui.tr(label)}
            </label>
        }
    };
    let reset = move |_| {
        let signed_in = ui.app.with(|rt| rt.session.active.is_some());
        ui.ws.update(|ws| ws.reset_to_preset(signed_in));
    };
    view! {
        <div class="page prose">
            <h2>{move || ui.tr("Settings")}</h2>
            <fieldset><legend>{move || ui.tr("Theme")}</legend>
                {theme(Theme::System, "Follow the system")} {theme(Theme::Light, "Light")} {theme(Theme::Dark, "Dark")}
            </fieldset>
            <fieldset><legend>{move || ui.tr("Text size")}</legend>
                {size(14, "Small")} {size(16, "Medium")} {size(18, "Large")}
            </fieldset>
            <fieldset><legend>{move || ui.tr("Density")}</legend>
                <label class="radio"><input type="radio" name="density" checked=move || !ui.settings.get().compact on:change=move |_| ui.settings.update(|s| s.compact = false)/>{move || ui.tr("Comfortable")}</label>
                <label class="radio"><input type="radio" name="density" checked=move || ui.settings.get().compact on:change=move |_| ui.settings.update(|s| s.compact = true)/>{move || ui.tr("Compact")}</label>
            </fieldset>
            <fieldset><legend>{move || ui.tr("Language")}</legend>
                <select aria-label="Language" prop:value=move || match ui.settings.get().language { None => "system", Some(lkjstr_core::appearance::Language::English) => "en", Some(_) => "ja" } on:change=move |ev| ui.settings.update(|s| s.language = match event_target_value(&ev).as_str() { "en" => Some(lkjstr_core::appearance::Language::English), "ja" => Some(lkjstr_core::appearance::Language::Japanese), _ => None })>
                    <option value="system">{move || ui.tr("Follow the system")}</option><option value="en">"English"</option><option value="ja">"日本語"</option>
                </select>
            </fieldset>
            <fieldset><legend>{move || ui.tr("Layout")}</legend>
                <p class="muted">{move || ui.tr("Layouts save automatically on this device.")}</p>
                <button on:click=reset>{move || ui.tr("Reset to the default layout")}</button>
            </fieldset>
        </div>
    }
}
