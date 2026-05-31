use leptos::prelude::*;
use lkjstr_domain::TabKind;

use crate::app::RuntimeSignal;
use crate::workspace::pane::PaneView;
use crate::workspace::persistence::WorkspacePersistence;
use crate::workspace::state::{self, TabSequence};
use crate::workspace::stats_provider::StatsProvider;

#[component]
pub fn WorkspaceShell(
    runtime: RuntimeSignal,
    persistence: Option<WorkspacePersistence>,
    stats_provider: Option<StatsProvider>,
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
                            stats_provider=stats_provider.clone()
                        />
                    }
                }).collect_view()}
            </section>
        </main>
    }
}
