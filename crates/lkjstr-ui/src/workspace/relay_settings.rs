use std::collections::BTreeMap;

use leptos::prelude::*;
use lkjstr_domain::{RelayPurpose, RelaySet};

use crate::workspace::relay_settings_provider::{RelaySettingsProvider, run_relay_settings_result};
use crate::workspace::relay_settings_section::{RelaySettingsUiState, relay_section};

#[component]
pub fn RelaySettingsTab(provider: Option<RelaySettingsProvider>) -> impl IntoView {
    let provider = provider.unwrap_or_else(RelaySettingsProvider::storage_unavailable);
    let sets = RwSignal::new(Vec::<RelaySet>::new());
    let selected_default_id = RwSignal::new(String::from("public-default"));
    let status = RwSignal::new(String::from("Loading relay settings"));
    let drafts = RwSignal::new(BTreeMap::<String, String>::new());

    run_relay_settings_result(sets, selected_default_id, status, {
        let provider = provider.clone();
        move |complete| provider.load(complete)
    });
    let state = RelaySettingsUiState {
        selected_default_id,
        provider,
        sets,
        status,
        drafts,
    };
    let user_state = state.clone();
    let discovery_state = state.clone();

    view! {
        <section class="relay-settings-tab lkjstr-relay-settings" aria-label="Relay Settings" data-scroll-owner="">
            <p role="status">{move || status.get()}</p>
            {move || relay_section(
                "User relays",
                RelayPurpose::User,
                purpose_sets(sets.get(), RelayPurpose::User),
                user_state.clone(),
            )}
            {move || relay_section(
                "Discovery relays",
                RelayPurpose::Discovery,
                purpose_sets(sets.get(), RelayPurpose::Discovery),
                discovery_state.clone(),
            )}
        </section>
    }
}

fn purpose_sets(sets: Vec<RelaySet>, purpose: RelayPurpose) -> Vec<RelaySet> {
    sets.into_iter()
        .filter(|set| set.purpose == purpose)
        .collect()
}
