use leptos::prelude::*;
use lkjstr_domain::{TabKind, WorkspaceTab};

use crate::app::RuntimeSignal;
use crate::workspace::menu::NewTabMenu;
use crate::workspace::state::TabSequence;
use crate::workspace::welcome::WelcomeTab;

#[component]
pub fn TabBody(
    runtime: RuntimeSignal,
    sequence: TabSequence,
    pane_id: String,
    tab: WorkspaceTab,
) -> impl IntoView {
    let kind = tab.kind;
    let tab_id = tab.id;
    let title = tab.title;
    view! {
        <div class="lkjstr-tab-body" data-tab-kind=tab_kind_attr(kind)>
            <h1>{title}</h1>
            {tab_content(runtime, sequence, pane_id, tab_id, kind)}
        </div>
    }
}

fn tab_content(
    runtime: RuntimeSignal,
    sequence: TabSequence,
    pane_id: String,
    tab_id: String,
    kind: TabKind,
) -> impl IntoView {
    match kind {
        TabKind::Welcome => view! {
            <WelcomeTab runtime=runtime sequence=sequence pane_id=pane_id />
        }
        .into_any(),
        TabKind::NewTab => view! {
            <NewTabMenu
                runtime=runtime
                sequence=sequence
                pane_id=pane_id
                tab_id=Some(tab_id)
            />
        }
        .into_any(),
        _ => view! {
            <div class="lkjstr-pending-surface">
                <p>{pending_message(kind)}</p>
            </div>
        }
        .into_any(),
    }
}

fn pending_message(kind: TabKind) -> &'static str {
    match kind {
        TabKind::Timeline => "The Rust Home body is not converted yet.",
        TabKind::Global => "The Rust Global body is not converted yet.",
        TabKind::Notifications => "The Rust Notifications body is not converted yet.",
        TabKind::Profile => "The Rust Profile body is not converted yet.",
        TabKind::ProfileEdit => "The Rust Profile Edit body is not converted yet.",
        TabKind::UploadSettings => "The Rust Upload Settings body is not converted yet.",
        TabKind::AccountManager => "The Rust Accounts body is not converted yet.",
        TabKind::NpubMiner => "The Rust Mine npub body is not converted yet.",
        TabKind::Thread => "The Rust Thread body is not converted yet.",
        TabKind::RelayMonitor => "The Rust lkjstr Log body is not converted yet.",
        TabKind::RelaySettings => "The Rust Relay Settings body is not converted yet.",
        TabKind::NetworkStats => "The Rust Stats body is not converted yet.",
        TabKind::Search => "The Rust Search body is not converted yet.",
        TabKind::CustomRequest => "The Rust Custom Request body is not converted yet.",
        TabKind::AuthorContext => "The Rust Author Context body is not converted yet.",
        TabKind::Tweet => "The Rust Tweet body is not converted yet.",
        TabKind::Settings => "The Rust Settings body is not converted yet.",
        TabKind::Welcome | TabKind::NewTab => "",
    }
}

const fn tab_kind_attr(kind: TabKind) -> &'static str {
    match kind {
        TabKind::Welcome => "welcome",
        TabKind::NewTab => "new-tab",
        TabKind::Timeline => "timeline",
        TabKind::Global => "global",
        TabKind::Notifications => "notifications",
        TabKind::Profile => "profile",
        TabKind::ProfileEdit => "profile-edit",
        TabKind::UploadSettings => "upload-settings",
        TabKind::AccountManager => "account-manager",
        TabKind::NpubMiner => "npub-miner",
        TabKind::Thread => "thread",
        TabKind::RelayMonitor => "relay-monitor",
        TabKind::RelaySettings => "relay-settings",
        TabKind::NetworkStats => "network-stats",
        TabKind::Search => "search",
        TabKind::CustomRequest => "custom-request",
        TabKind::AuthorContext => "author-context",
        TabKind::Tweet => "tweet",
        TabKind::Settings => "settings",
    }
}
