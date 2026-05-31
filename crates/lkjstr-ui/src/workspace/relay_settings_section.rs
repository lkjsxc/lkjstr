use std::collections::BTreeMap;

use leptos::prelude::*;
use lkjstr_domain::{RelayPurpose, RelaySet};

use crate::workspace::relay_row::relay_row;
use crate::workspace::relay_settings_provider::{RelaySettingsProvider, run_relay_settings_result};

#[derive(Clone)]
pub struct RelaySettingsUiState {
    pub selected_default_id: RwSignal<String>,
    pub provider: RelaySettingsProvider,
    pub sets: RwSignal<Vec<RelaySet>>,
    pub status: RwSignal<String>,
    pub drafts: RwSignal<BTreeMap<String, String>>,
}

pub fn relay_section(
    title: &'static str,
    purpose: RelayPurpose,
    rows: Vec<RelaySet>,
    state: RelaySettingsUiState,
) -> impl IntoView {
    view! {
        <section class="relay-purpose" aria-label=title>
            <h2>{title}</h2>
            {rows.into_iter().map(|set| relay_set_article(
                purpose,
                set,
                state.clone(),
            )).collect_view()}
        </section>
    }
}

fn relay_set_article(
    purpose: RelayPurpose,
    set: RelaySet,
    state: RelaySettingsUiState,
) -> impl IntoView {
    let input_set_id = set.id.clone();
    let value_set_id = set.id.clone();
    let add_set_id = set.id.clone();
    let default_set_id = set.id.clone();
    let provider = state.provider.clone();
    let selected_default_id = state.selected_default_id;
    let sets = state.sets;
    let status = state.status;
    let drafts = state.drafts;
    let restore_provider = provider.clone();
    let default_provider = provider.clone();
    let add_provider = provider.clone();
    let draft_value = move || draft_for(drafts, &value_set_id);
    let draft_input = move |event| {
        let value = event_target_value(&event);
        drafts.update(|items| {
            items.insert(input_set_id.clone(), value);
        });
    };
    let add = move |_| {
        let input = draft_for(drafts, &add_set_id);
        run_relay_settings_result(sets, selected_default_id, status, {
            let provider = add_provider.clone();
            let set_id = add_set_id.clone();
            move |complete| provider.add(set_id, input, complete)
        });
    };
    let restore = move |_| {
        run_relay_settings_result(sets, selected_default_id, status, {
            let provider = restore_provider.clone();
            move |complete| provider.restore(purpose, complete)
        });
    };
    let make_default = move |_| {
        run_relay_settings_result(sets, selected_default_id, status, {
            let provider = default_provider.clone();
            let set_id = default_set_id.clone();
            move |complete| provider.make_default(set_id, complete)
        });
    };
    view! {
        <article class="relay-set">
            <h3>{set_heading(&set, selected_default_id)}</h3>
            <div class="relay-toolbar">
                <input
                    aria-label=format!("{} relay URL", set.name)
                    prop:value=draft_value
                    on:input=draft_input
                />
                <button type="button" on:click=add>"Add relay"</button>
                {default_button(purpose, make_default)}
                <button type="button" on:click=restore>"Restore defaults"</button>
            </div>
            <div class="relay-row-list">
                {set.relays.into_iter().map(|relay| relay_row(
                    set.id.clone(),
                    purpose,
                    relay,
                    provider.clone(),
                    sets,
                    selected_default_id,
                    status,
                )).collect_view()}
            </div>
        </article>
    }
}

fn set_heading(set: &RelaySet, selected_default_id: RwSignal<String>) -> String {
    if selected_default_id.get() == set.id {
        format!("{} default", set.name)
    } else {
        set.name.clone()
    }
}

fn draft_for(drafts: RwSignal<BTreeMap<String, String>>, set_id: &str) -> String {
    drafts.get().get(set_id).cloned().unwrap_or_default()
}

fn default_button(
    purpose: RelayPurpose,
    on_click: impl Fn(leptos::ev::MouseEvent) + 'static,
) -> AnyView {
    if purpose != RelayPurpose::User {
        return ().into_any();
    }
    view! { <button type="button" on:click=on_click>"Use as default"</button> }.into_any()
}
