use leptos::prelude::*;
use lkjstr_domain::PaneNode;

use crate::app::RuntimeSignal;
use crate::workspace::accounts_provider::AccountsProvider;
use crate::workspace::persistence::WorkspacePersistence;
use crate::workspace::relay_settings_provider::RelaySettingsProvider;
use crate::workspace::settings_provider::SettingsProvider;
use crate::workspace::state::{self, TabSequence};
use crate::workspace::stats_provider::StatsProvider;
use crate::workspace::tab_body::TabBody;
use crate::workspace::upload_settings_provider::UploadSettingsProvider;

#[component]
pub fn PaneView(
    runtime: RuntimeSignal,
    sequence: TabSequence,
    pane: PaneNode,
    persistence: Option<WorkspacePersistence>,
    accounts_provider: Option<AccountsProvider>,
    relay_settings_provider: Option<RelaySettingsProvider>,
    stats_provider: Option<StatsProvider>,
    settings_provider: Option<SettingsProvider>,
    upload_settings_provider: Option<UploadSettingsProvider>,
) -> impl IntoView {
    let pane_id = pane.id.clone();
    let pane_attr = pane.id.clone();
    let tabs_pane_id = pane.id.clone();
    let body_pane_id = pane.id;
    let tabs_persistence = persistence.clone();
    let body_persistence = persistence.clone();
    let body_accounts_provider = accounts_provider.clone();
    let body_relay_settings_provider = relay_settings_provider.clone();
    let body_stats_provider = stats_provider.clone();
    let body_settings_provider = settings_provider.clone();
    let body_upload_settings_provider = upload_settings_provider.clone();
    let title = move || state::active_title(runtime, &pane_id);

    view! {
        <article class="lkjstr-pane" data-pane-id=pane_attr>
            <div class="lkjstr-pane-head">
                <span class="lkjstr-pane-title">{title}</span>
                <button type="button" aria-label="Pane menu">"..."</button>
            </div>
            <nav class="lkjstr-tab-strip" aria-label="Tabs">
                {move || {
                    let pane_id = tabs_pane_id.clone();
                    let persistence = tabs_persistence.clone();
                    state::pane_tabs(runtime, &pane_id).into_iter().map(move |tab| {
                        let selected_tab_id = tab.id.clone();
                        let focus_tab_id = tab.id.clone();
                        let focus_pane_id = pane_id.clone();
                        let persistence_for_focus = persistence.clone();
                        let selected = move || state::is_focused(runtime, &selected_tab_id);
                        let focus = move |_| {
                            state::focus(
                                runtime,
                                focus_pane_id.clone(),
                                focus_tab_id.clone(),
                                persistence_for_focus.clone(),
                                1,
                            );
                        };
                        view! {
                            <button type="button" class:active=selected on:click=focus>
                                {tab.title}
                            </button>
                        }
                    }).collect_view()
                }}
            </nav>
            <section class="lkjstr-pane-body">
                {move || {
                    let pane_id = body_pane_id.clone();
                    let persistence = body_persistence.clone();
                    let accounts_provider = body_accounts_provider.clone();
                    let relay_settings_provider = body_relay_settings_provider.clone();
                    let stats_provider = body_stats_provider.clone();
                    let settings_provider = body_settings_provider.clone();
                    let upload_settings_provider = body_upload_settings_provider.clone();
                    state::active_tab(runtime, &pane_id).into_iter().map(move |tab| {
                        view! {
                            <TabBody
                                runtime=runtime
                                sequence=sequence
                                pane_id=pane_id.clone()
                                tab=tab
                                persistence=persistence.clone()
                                accounts_provider=accounts_provider.clone()
                                relay_settings_provider=relay_settings_provider.clone()
                                stats_provider=stats_provider.clone()
                                settings_provider=settings_provider.clone()
                                upload_settings_provider=upload_settings_provider.clone()
                            />
                        }
                    }).collect_view()
                }}
            </section>
        </article>
    }
}
