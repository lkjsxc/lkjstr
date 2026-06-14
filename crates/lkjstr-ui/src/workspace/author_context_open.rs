use std::collections::BTreeMap;

use leptos::prelude::*;
use lkjstr_domain::{NewTabOption, TabKind};

use crate::app::RuntimeSignal;
use crate::workspace::author_context;
use crate::workspace::author_context_actions::AuthorContextActions;
use crate::workspace::persistence::WorkspacePersistence;
use crate::workspace::profile_action_tabs::pubkey_tab_callback;
use crate::workspace::profile_clipboard_provider::ProfileCopyProvider;
use crate::workspace::state::{self, TabSequence};
use crate::workspace::tab_content_input::TabContentInput;

pub(crate) fn author_context_tab_content(input: TabContentInput) -> impl IntoView {
    let actions = actions(
        input.runtime,
        input.sequence,
        input.pane_id.clone(),
        input.persistence.clone(),
        input.profile_copy_provider,
    );
    author_context::author_context_tab_content(
        input.tab_id,
        input.author_context_event_id,
        input.author_context_pubkey,
        input.author_context_feed_provider,
        actions,
    )
}

fn actions(
    runtime: RuntimeSignal,
    sequence: TabSequence,
    pane_id: String,
    persistence: Option<WorkspacePersistence>,
    copy_event_id: Option<ProfileCopyProvider>,
) -> AuthorContextActions {
    AuthorContextActions {
        open_profile: Some(pubkey_tab_callback(
            runtime,
            sequence,
            pane_id.clone(),
            persistence.clone(),
            TabKind::Profile,
        )),
        open_thread: Some(event_tab_callback(
            runtime,
            sequence,
            pane_id.clone(),
            persistence.clone(),
            TabKind::Thread,
        )),
        open_author_context: Some(author_context_callback(
            runtime,
            sequence,
            pane_id,
            persistence,
        )),
        copy_event_id,
    }
}

fn event_tab_callback(
    runtime: RuntimeSignal,
    sequence: TabSequence,
    pane_id: String,
    persistence: Option<WorkspacePersistence>,
    kind: TabKind,
) -> Callback<String> {
    Callback::new(move |event_id| {
        open_or_focus_event_tab(
            runtime,
            sequence,
            pane_id.clone(),
            persistence.clone(),
            event_option(kind, event_id),
        );
    })
}

fn author_context_callback(
    runtime: RuntimeSignal,
    sequence: TabSequence,
    pane_id: String,
    persistence: Option<WorkspacePersistence>,
) -> Callback<(String, String)> {
    Callback::new(move |(event_id, pubkey)| {
        open_or_focus_event_tab(
            runtime,
            sequence,
            pane_id.clone(),
            persistence.clone(),
            author_context_option(event_id, pubkey),
        );
    })
}

fn open_or_focus_event_tab(
    runtime: RuntimeSignal,
    sequence: TabSequence,
    pane_id: String,
    persistence: Option<WorkspacePersistence>,
    option: NewTabOption,
) {
    if let Some(tab_id) = matching_event_tab(runtime, &pane_id, option.kind, &option.config) {
        state::focus(runtime, pane_id, tab_id, persistence, 1);
        return;
    }
    state::open_option(runtime, sequence, Some(pane_id), option, persistence, 1);
}

fn matching_event_tab(
    runtime: RuntimeSignal,
    pane_id: &str,
    kind: TabKind,
    config: &BTreeMap<String, String>,
) -> Option<String> {
    let event_id = config.get("eventId")?;
    state::pane_tabs(runtime, pane_id)
        .into_iter()
        .find(|tab| tab.kind == kind && tab.config.get("eventId") == Some(event_id))
        .map(|tab| tab.id)
}

fn event_option(kind: TabKind, event_id: String) -> NewTabOption {
    NewTabOption {
        kind,
        label: "Thread",
        description: "Thread continuation.",
        aliases: &[],
        config: BTreeMap::from([("eventId".to_owned(), event_id)]),
    }
}

fn author_context_option(event_id: String, pubkey: String) -> NewTabOption {
    NewTabOption {
        kind: TabKind::AuthorContext,
        label: "Author Context",
        description: "Nearby notes from the same author.",
        aliases: &[],
        config: BTreeMap::from([
            ("eventId".to_owned(), event_id),
            ("pubkey".to_owned(), pubkey),
        ]),
    }
}

#[cfg(test)]
#[path = "author_context_open_tests.rs"]
mod author_context_open_tests;
