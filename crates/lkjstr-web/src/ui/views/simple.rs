//! Launcher (the `+` page), missing addresses and Settings.

use leptos::prelude::*;
use lkjstr_core::layout::TabId;
use lkjstr_core::{Open, View, launcher_choices};

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
pub fn NothingHere() -> impl IntoView {
    let ui = Ui::get();
    view! { <div class="page"><h2>{move || ui.tr("Nothing here")}</h2>
        <p>{move || ui.tr("This address does not open a view.")}</p>
        <button on:click=move |_| { ui.open(View::Global, Open::Here); }>{move || ui.tr("Browse Global")}</button>
    </div> }
}

#[component]
pub fn SettingsView(tab: TabId) -> impl IntoView {
    let ui = Ui::get();
    let theme = move |value: Theme, label: &'static str| {
        view! {
            <label class="radio">
                <input type="radio" name=format!("theme-{tab}") checked=move || ui.settings.get().theme == value
                    on:change=move |_| ui.settings.update(|s| s.theme = value)/>
                {move || ui.tr(label)}
            </label>
        }
    };
    let size = move |value: u8, label: &'static str| {
        view! {
            <label class="radio">
                <input type="radio" name=format!("text-{tab}") checked=move || ui.settings.get().text == value
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
                <label class="radio"><input type="radio" name=format!("density-{tab}") checked=move || !ui.settings.get().compact on:change=move |_| ui.settings.update(|s| s.compact = false)/>{move || ui.tr("Comfortable")}</label>
                <label class="radio"><input type="radio" name=format!("density-{tab}") checked=move || ui.settings.get().compact on:change=move |_| ui.settings.update(|s| s.compact = true)/>{move || ui.tr("Compact")}</label>
            </fieldset>
            <fieldset><legend>{move || ui.tr("Language")}</legend>
                <select aria-label=move || ui.tr("Language") prop:value=move || match ui.settings.get().language { None => "system", Some(lkjstr_core::appearance::Language::English) => "en", Some(_) => "ja" } on:change=move |ev| ui.settings.update(|s| s.language = match event_target_value(&ev).as_str() { "en" => Some(lkjstr_core::appearance::Language::English), "ja" => Some(lkjstr_core::appearance::Language::Japanese), _ => None })>
                    <option value="system">{move || ui.tr("Follow the system")}</option><option value="en">{move || ui.tr("English")}</option><option value="ja">{move || ui.tr("日本語")}</option>
                </select>
            </fieldset>
            <fieldset><legend>{move || ui.tr("Tabs and interface")}</legend>
                <label class="check"><input type="checkbox" prop:checked=move || ui.settings.get().middle_close on:change=move |ev| ui.settings.update(|s| s.middle_close=event_target_checked(&ev))/>{move || ui.tr("Middle click closes tabs")}</label>
                <label>{move || ui.tr("Tab width")}<select aria-label=move || ui.tr("Tab width") prop:value=move || ui.settings.get().tab_width.to_string() on:change=move |ev| ui.settings.update(|s| s.tab_width=event_target_value(&ev).parse().unwrap_or(0))>
                    <option value="0">{move || ui.tr("Fit title")}</option><option value="96">{move || ui.tr("96 px")}</option><option value="140">{move || ui.tr("140 px")}</option><option value="180">{move || ui.tr("180 px")}</option><option value="220">{move || ui.tr("220 px")}</option><option value="240">{move || ui.tr("240 px")}</option>
                </select></label>
                <label>{move || ui.tr("Interface scale")}<input type="range" aria-label=move || ui.tr("Interface scale") min="80" max="140" step="5" prop:value=move || ui.settings.get().scale.to_string() on:input=move |ev| ui.settings.update(|s| s.scale=event_target_value(&ev).parse().unwrap_or(100))/>{move || format!("{}%",ui.settings.get().scale)}</label>
            </fieldset>
            <fieldset><legend>{move || ui.tr("Connection")}</legend><label class="check"><input type="checkbox" prop:checked=move || ui.settings.get().data_saver on:change=move |ev| ui.settings.update(|s| s.data_saver=event_target_checked(&ev))/>{move || ui.tr("Data saver: load media on press; pause prefetch")}</label></fieldset>
            <fieldset><legend>{move || ui.tr("Workspace")}</legend>
                <label>{move || ui.tr("Name")}<input aria-label=move || ui.tr("Workspace name") maxlength="32" prop:value=move || ui.tr(&ui.spaces.with(|s| s.names[s.active].clone())) on:input=move |ev| { let name=event_target_value(&ev); ui.spaces.update(|s| s.names[s.active]=name); }/></label>
            </fieldset>
            <super::storage::StorageStatus/>
            <fieldset><legend>{move || ui.tr("Layout")}</legend>
                <p class="muted">{move || ui.tr("Layouts save automatically on this device.")}</p>
                <button on:click=reset>{move || ui.tr("Reset to the default layout")}</button>
            </fieldset>
        </div>
    }
}
