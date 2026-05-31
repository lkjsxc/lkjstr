use leptos::prelude::*;
use lkjstr_domain::TabKind;

use crate::app::RuntimeSignal;
use crate::workspace::accounts_provider::AccountsProvider;
use crate::workspace::pane::PaneView;
use crate::workspace::persistence::WorkspacePersistence;
use crate::workspace::relay_settings_provider::RelaySettingsProvider;
use crate::workspace::settings_provider::SettingsProvider;
use crate::workspace::state::{self, TabSequence};
use crate::workspace::stats_provider::StatsProvider;
use crate::workspace::upload_settings_provider::UploadSettingsProvider;

#[component]
pub fn WorkspaceShell(
    runtime: RuntimeSignal,
    persistence: Option<WorkspacePersistence>,
    accounts_provider: Option<AccountsProvider>,
    relay_settings_provider: Option<RelaySettingsProvider>,
    stats_provider: Option<StatsProvider>,
    settings_provider: Option<SettingsProvider>,
    upload_settings_provider: Option<UploadSettingsProvider>,
) -> impl IntoView {
    let sequence: TabSequence = RwSignal::new(0_u64);
    let persistence_for_open = persistence.clone();
    let open_new_tab = move |_| {
        state::open_kind(
            runtime,
            sequence,
            None,
            TabKind::NewTab,
            persistence_for_open.clone(),
            1,
        );
    };

    view! {
        <main class="lkjstr-shell" data-testid="rust-workspace-shell">
            <header class="lkjstr-activity-bar">
                <strong>"lkjstr"</strong>
                <button type="button" on:click=open_new_tab aria-label="New tab">"+"</button>
            </header>
            <section class="lkjstr-pane-grid">
                {move || state::pane_ids(runtime).into_iter().map(|pane| {
                    view! {
                        <PaneView
                            runtime=runtime
                            sequence=sequence
                            pane=pane
                            persistence=persistence.clone()
                            accounts_provider=accounts_provider.clone()
                            relay_settings_provider=relay_settings_provider.clone()
                            stats_provider=stats_provider.clone()
                            settings_provider=settings_provider.clone()
                            upload_settings_provider=upload_settings_provider.clone()
                        />
                    }
                }).collect_view()}
            </section>
        </main>
    }
}
