use std::collections::BTreeMap;

use leptos::prelude::*;
use lkjstr_domain::{NewTabOption, TabKind, title_for};

use crate::app::RuntimeSignal;
use crate::workspace::persistence::WorkspacePersistence;
use crate::workspace::state::{self, TabSequence};

pub(crate) fn pubkey_tab_callback(
    runtime: RuntimeSignal,
    sequence: TabSequence,
    pane_id: String,
    persistence: Option<WorkspacePersistence>,
    kind: TabKind,
) -> Callback<String> {
    Callback::new(move |pubkey| {
        open_or_focus_pubkey_tab(
            runtime,
            sequence,
            pane_id.clone(),
            persistence.clone(),
            kind,
            pubkey,
        );
    })
}

pub(crate) fn kind_callback(
    runtime: RuntimeSignal,
    sequence: TabSequence,
    pane_id: String,
    persistence: Option<WorkspacePersistence>,
    kind: TabKind,
) -> Callback<()> {
    Callback::new(move |()| {
        if let Some(tab_id) = matching_kind_tab(runtime, &pane_id, kind) {
            state::focus(runtime, pane_id.clone(), tab_id, persistence.clone(), 1);
            return;
        }
        state::open_kind(
            runtime,
            sequence,
            Some(pane_id.clone()),
            kind,
            persistence.clone(),
            1,
        );
    })
}

fn open_or_focus_pubkey_tab(
    runtime: RuntimeSignal,
    sequence: TabSequence,
    pane_id: String,
    persistence: Option<WorkspacePersistence>,
    kind: TabKind,
    pubkey: String,
) {
    if let Some(tab_id) = matching_pubkey_tab(runtime, &pane_id, kind, &pubkey) {
        state::focus(runtime, pane_id, tab_id, persistence, 1);
        return;
    }
    state::open_option(
        runtime,
        sequence,
        Some(pane_id),
        pubkey_option(kind, pubkey),
        persistence,
        1,
    );
}

fn matching_pubkey_tab(
    runtime: RuntimeSignal,
    pane_id: &str,
    kind: TabKind,
    pubkey: &str,
) -> Option<String> {
    state::pane_tabs(runtime, pane_id)
        .into_iter()
        .find(|tab| tab.kind == kind && tab.config.get("pubkey").is_some_and(|item| item == pubkey))
        .map(|tab| tab.id)
}

fn matching_kind_tab(runtime: RuntimeSignal, pane_id: &str, kind: TabKind) -> Option<String> {
    state::pane_tabs(runtime, pane_id)
        .into_iter()
        .find(|tab| tab.kind == kind)
        .map(|tab| tab.id)
}

fn pubkey_option(kind: TabKind, pubkey: String) -> NewTabOption {
    let description = match kind {
        TabKind::Followees => "Viewed profile following list.",
        TabKind::UserTimeline => "Viewed profile public timeline.",
        _ => "Profile action tab.",
    };
    NewTabOption {
        kind,
        label: title_for(kind),
        description,
        aliases: &[],
        config: BTreeMap::from([("pubkey".to_owned(), pubkey)]),
    }
}

#[cfg(test)]
mod tests {
    use leptos::prelude::{Callable, GetUntracked, RwSignal};

    use super::*;

    #[test]
    fn pubkey_callbacks_open_or_focus_matching_tabs() -> Result<(), &'static str> {
        assert_pubkey_callback(TabKind::Profile)?;
        assert_pubkey_callback(TabKind::Followees)?;
        assert_pubkey_callback(TabKind::UserTimeline)
    }

    #[test]
    fn kind_callback_opens_or_focuses_matching_profile_edit_tab() -> Result<(), &'static str> {
        let runtime = runtime();
        let callback = kind_callback(
            runtime,
            RwSignal::new(0),
            "bootstrap-welcome-pane".to_owned(),
            None,
            TabKind::ProfileEdit,
        );

        callback.run(());
        callback.run(());

        assert_single_kind_tab(runtime, TabKind::ProfileEdit)
    }

    fn assert_pubkey_callback(kind: TabKind) -> Result<(), &'static str> {
        let runtime = runtime();
        let callback = pubkey_tab_callback(
            runtime,
            RwSignal::new(0),
            "bootstrap-welcome-pane".to_owned(),
            None,
            kind,
        );

        callback.run(pubkey());
        callback.run(pubkey());

        assert_single_pubkey_tab(runtime, kind)
    }

    fn assert_single_pubkey_tab(runtime: RuntimeSignal, kind: TabKind) -> Result<(), &'static str> {
        let workspace = runtime.get_untracked().workspace;
        let tabs = workspace
            .tabs
            .values()
            .filter(|tab| tab.kind == kind)
            .collect::<Vec<_>>();
        let tab = tabs.first().ok_or("missing pubkey tab")?;
        assert_eq!(tabs.len(), 1);
        assert_eq!(
            tab.config.get("pubkey").map(String::as_str),
            Some(pubkey().as_str())
        );
        assert_eq!(workspace.focused_tab_id.as_deref(), Some(tab.id.as_str()));
        Ok(())
    }

    fn assert_single_kind_tab(runtime: RuntimeSignal, kind: TabKind) -> Result<(), &'static str> {
        let workspace = runtime.get_untracked().workspace;
        let tabs = workspace
            .tabs
            .values()
            .filter(|tab| tab.kind == kind)
            .collect::<Vec<_>>();
        let tab = tabs.first().ok_or("missing kind tab")?;
        assert_eq!(tabs.len(), 1);
        assert_eq!(workspace.focused_tab_id.as_deref(), Some(tab.id.as_str()));
        Ok(())
    }

    fn runtime() -> RuntimeSignal {
        RwSignal::new(lkjstr_app::start_workspace(crate::app::default_startup_input()).state)
    }

    fn pubkey() -> String {
        "a".repeat(64)
    }
}
