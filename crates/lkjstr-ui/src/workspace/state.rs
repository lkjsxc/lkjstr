use leptos::prelude::{GetUntracked, RwSignal, Set, Update, With};
use lkjstr_app::{
    convert_runtime_tab, focus_runtime_tab, open_configured_runtime_tab, open_runtime_tab,
};
use lkjstr_domain::{NewTabIds, NewTabOption, PaneNode, TabKind, WorkspaceTab};

use crate::app::RuntimeSignal;
use crate::workspace::WorkspacePersistence;

pub type TabSequence = RwSignal<u64>;

pub fn open_kind(
    runtime: RuntimeSignal,
    sequence: TabSequence,
    pane_id: Option<String>,
    kind: TabKind,
    persistence: Option<WorkspacePersistence>,
    now: u64,
) {
    let ids = next_ids(sequence, kind);
    runtime.update(|state| {
        *state = open_runtime_tab(state.clone(), pane_id.as_deref(), kind, ids, now);
    });
    persist(runtime, persistence);
}

pub fn open_option(
    runtime: RuntimeSignal,
    sequence: TabSequence,
    pane_id: Option<String>,
    option: NewTabOption,
    persistence: Option<WorkspacePersistence>,
    now: u64,
) {
    let ids = next_ids(sequence, option.kind);
    runtime.update(|state| {
        *state = open_configured_runtime_tab(
            state.clone(),
            pane_id.as_deref(),
            option.kind,
            ids,
            option.config.clone(),
            now,
        );
    });
    persist(runtime, persistence);
}

pub fn convert_option(
    runtime: RuntimeSignal,
    pane_id: String,
    tab_id: String,
    option: NewTabOption,
    persistence: Option<WorkspacePersistence>,
    now: u64,
) {
    runtime.update(|state| {
        *state = convert_runtime_tab(
            state.clone(),
            &pane_id,
            &tab_id,
            option.kind,
            option.config.clone(),
            now,
        );
    });
    persist(runtime, persistence);
}

pub fn focus(
    runtime: RuntimeSignal,
    pane_id: String,
    tab_id: String,
    persistence: Option<WorkspacePersistence>,
    now: u64,
) {
    runtime.update(|state| {
        *state = focus_runtime_tab(state.clone(), &pane_id, &tab_id, now);
    });
    persist(runtime, persistence);
}

pub fn pane_ids(runtime: RuntimeSignal) -> Vec<PaneNode> {
    runtime.with(|state| {
        state
            .workspace
            .layout
            .as_ref()
            .map(|layout| {
                layout
                    .pane_ids()
                    .into_iter()
                    .filter_map(|id| layout.find_pane(&id).cloned())
                    .collect()
            })
            .unwrap_or_default()
    })
}

pub fn pane_tabs(runtime: RuntimeSignal, pane_id: &str) -> Vec<WorkspaceTab> {
    runtime.with(|state| {
        let Some(layout) = state.workspace.layout.as_ref() else {
            return Vec::new();
        };
        let Some(pane) = layout.find_pane(pane_id) else {
            return Vec::new();
        };
        let Some(group) = state.workspace.tab_groups.get(&pane.tab_group_id) else {
            return Vec::new();
        };
        group
            .tab_ids
            .iter()
            .filter_map(|id| state.workspace.tabs.get(id).cloned())
            .collect()
    })
}

pub fn active_tab(runtime: RuntimeSignal, pane_id: &str) -> Option<WorkspaceTab> {
    pane_tabs(runtime, pane_id)
        .into_iter()
        .find(|tab| is_focused(runtime, &tab.id))
        .or_else(|| pane_tabs(runtime, pane_id).into_iter().next())
}

pub fn active_title(runtime: RuntimeSignal, pane_id: &str) -> String {
    active_tab(runtime, pane_id)
        .map(|tab| tab.title)
        .unwrap_or_else(|| "Workspace".to_owned())
}

pub fn is_focused(runtime: RuntimeSignal, tab_id: &str) -> bool {
    runtime.with(|state| state.workspace.focused_tab_id.as_deref() == Some(tab_id))
}

pub const fn tab_kind_key(kind: TabKind) -> &'static str {
    match kind {
        TabKind::Welcome => "welcome",
        TabKind::NewTab => "new-tab",
        TabKind::Timeline => "timeline",
        TabKind::Global => "global",
        TabKind::PublicChat => "public-chat",
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

fn next_ids(sequence: TabSequence, kind: TabKind) -> NewTabIds {
    let index = sequence.get_untracked() + 1;
    sequence.set(index);
    NewTabIds {
        tab_id: format!("rust-{}-{index}", tab_kind_key(kind)),
    }
}

fn persist(runtime: RuntimeSignal, persistence: Option<WorkspacePersistence>) {
    if let Some(persistence) = persistence {
        persistence.save(runtime.get_untracked().workspace);
    }
}
