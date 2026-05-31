use leptos::prelude::*;
use lkjstr_domain::TabKind;

use crate::app::RuntimeSignal;
use crate::workspace::persistence::WorkspacePersistence;
use crate::workspace::state::{self, TabSequence};

const ACTIONS: &[(TabKind, &str, &str)] = &[
    (
        TabKind::AccountManager,
        "Open Accounts",
        "Manage local and extension-backed identities.",
    ),
    (
        TabKind::RelaySettings,
        "Open Relay Settings",
        "Choose read and write relays.",
    ),
    (
        TabKind::Timeline,
        "Open Home",
        "Read the selected account follow timeline.",
    ),
    (
        TabKind::Notifications,
        "Open Notifications",
        "Inspect account activity.",
    ),
    (
        TabKind::Tweet,
        "Open Tweet",
        "Compose and queue a signed note.",
    ),
    (
        TabKind::NetworkStats,
        "Open Stats",
        "Inspect runtime and storage diagnostics.",
    ),
];

#[component]
pub fn WelcomeTab(
    runtime: RuntimeSignal,
    sequence: TabSequence,
    pane_id: String,
    persistence: Option<WorkspacePersistence>,
) -> impl IntoView {
    view! {
        <div class="lkjstr-welcome">
            <section>
                <h2>"Workspace"</h2>
                <p>
                    "lkjstr is a browser-first Nostr workspace for reading timelines, composing notes, inspecting relay behavior, managing signing accounts, and following event threads without a server-side account system."
                </p>
            </section>
            <section>
                <h2>"Start"</h2>
                <div class="lkjstr-action-list">
                    {ACTIONS.iter().map(|(kind, label, description)| {
                        let action_kind = *kind;
                        let key = state::tab_kind_key(action_kind);
                        let test_id = format!("welcome-open-{key}");
                        let pane_for_click = pane_id.clone();
                        let persistence_for_click = persistence.clone();
                        let open = move |_| {
                            state::open_kind(
                                runtime,
                                sequence,
                                Some(pane_for_click.clone()),
                                action_kind,
                                persistence_for_click.clone(),
                                1,
                            );
                        };
                        view! {
                            <button type="button" data-testid=test_id on:click=open>
                                <span>{*label}</span>
                                <small>{*description}</small>
                            </button>
                        }
                    }).collect_view()}
                </div>
            </section>
            <section>
                <h2>"Rust shell status"</h2>
                <p>
                    "This Rust shell owns startup panes, tab focus, Welcome actions, and New Tab conversion. Feed, relay, storage, and tool bodies remain in the existing product runtime until their Rust replacements pass matching tests."
                </p>
            </section>
        </div>
    }
}
