use leptos::prelude::*;
use lkjstr_domain::{RelayPatch, RelayPurpose, RelayRecord};

use crate::workspace::relay_settings_provider::{RelaySettingsProvider, run_relay_settings_result};

pub fn relay_row(
    set_id: String,
    purpose: RelayPurpose,
    relay: RelayRecord,
    provider: RelaySettingsProvider,
    sets: RwSignal<Vec<lkjstr_domain::RelaySet>>,
    selected_default_id: RwSignal<String>,
    status: RwSignal<String>,
) -> impl IntoView {
    let label = relay.label.clone();
    let label_aria = format!("Label {}", relay.url);
    let url_text = relay.url.clone();
    let label_patch = patch_handler(
        provider.clone(),
        set_id.clone(),
        relay.url.clone(),
        sets,
        selected_default_id,
        status,
        |event| RelayPatch::Label(event_target_value(&event)),
    );
    let enabled_patch = checkbox_handler(
        provider.clone(),
        set_id.clone(),
        relay.url.clone(),
        sets,
        selected_default_id,
        status,
        RelayPatch::Enabled,
    );
    let remove = remove_handler(
        provider.clone(),
        set_id.clone(),
        relay.url.clone(),
        sets,
        selected_default_id,
        status,
    );
    view! {
        <article class="relay-row">
            <input aria-label=label_aria prop:value=label on:change=label_patch />
            <code>{url_text}</code>
            <label>
                <input type="checkbox" prop:checked=relay.enabled on:change=enabled_patch />
                "enabled"
            </label>
            {read_write_controls(purpose, &set_id, &relay, provider.clone(), sets, selected_default_id, status)}
            <small>{format!("{:?}", relay.state).to_lowercase()}</small>
            <small>{format!(
                "{} attempts · {} ok · {} failed",
                relay.health.attempts,
                relay.health.successes,
                relay.health.failures,
            )}</small>
            <button type="button" on:click=remove>"Remove"</button>
            <small>"NIP-11 not fetched"</small>
        </article>
    }
}

fn read_write_controls(
    purpose: RelayPurpose,
    set_id: &str,
    relay: &RelayRecord,
    provider: RelaySettingsProvider,
    sets: RwSignal<Vec<lkjstr_domain::RelaySet>>,
    selected_default_id: RwSignal<String>,
    status: RwSignal<String>,
) -> AnyView {
    if purpose != RelayPurpose::User {
        return ().into_any();
    }
    let read_patch = checkbox_handler(
        provider.clone(),
        set_id.to_owned(),
        relay.url.clone(),
        sets,
        selected_default_id,
        status,
        RelayPatch::Read,
    );
    let write_patch = checkbox_handler(
        provider,
        set_id.to_owned(),
        relay.url.clone(),
        sets,
        selected_default_id,
        status,
        RelayPatch::Write,
    );
    view! {
        <label><input type="checkbox" prop:checked=relay.read on:change=read_patch />"read"</label>
        <label><input type="checkbox" prop:checked=relay.write on:change=write_patch />"write"</label>
    }
    .into_any()
}

fn patch_handler(
    provider: RelaySettingsProvider,
    set_id: String,
    url: String,
    sets: RwSignal<Vec<lkjstr_domain::RelaySet>>,
    selected_default_id: RwSignal<String>,
    status: RwSignal<String>,
    patch: impl Fn(leptos::ev::Event) -> RelayPatch + 'static,
) -> impl Fn(leptos::ev::Event) {
    move |event| {
        let patch = patch(event);
        run_relay_settings_result(sets, selected_default_id, status, {
            let provider = provider.clone();
            let set_id = set_id.clone();
            let url = url.clone();
            move |complete| provider.patch(set_id, url, patch, complete)
        });
    }
}

fn checkbox_handler(
    provider: RelaySettingsProvider,
    set_id: String,
    url: String,
    sets: RwSignal<Vec<lkjstr_domain::RelaySet>>,
    selected_default_id: RwSignal<String>,
    status: RwSignal<String>,
    patch: fn(bool) -> RelayPatch,
) -> impl Fn(leptos::ev::Event) {
    patch_handler(
        provider,
        set_id,
        url,
        sets,
        selected_default_id,
        status,
        move |event| patch(event_target_checked(&event)),
    )
}

fn remove_handler(
    provider: RelaySettingsProvider,
    set_id: String,
    url: String,
    sets: RwSignal<Vec<lkjstr_domain::RelaySet>>,
    selected_default_id: RwSignal<String>,
    status: RwSignal<String>,
) -> impl Fn(leptos::ev::MouseEvent) {
    move |_| {
        run_relay_settings_result(sets, selected_default_id, status, {
            let provider = provider.clone();
            let set_id = set_id.clone();
            let url = url.clone();
            move |complete| provider.remove(set_id, url, complete)
        });
    }
}
