use std::collections::BTreeMap;

use leptos::prelude::*;
use lkjstr_domain::{NewTabOption, TabKind};

use crate::app::RuntimeSignal;
use crate::workspace::feed_event_actions::FeedEventActions;
use crate::workspace::persistence::WorkspacePersistence;
use crate::workspace::profile_clipboard_provider::ProfileCopyProvider;
use crate::workspace::state::{self, TabSequence};

pub(crate) fn nearby_event_actions(
    runtime: RuntimeSignal,
    sequence: TabSequence,
    pane_id: String,
    persistence: Option<WorkspacePersistence>,
    copy_event_id: Option<ProfileCopyProvider>,
) -> FeedEventActions {
    FeedEventActions::nearby(
        Some(author_context_callback(
            runtime,
            sequence,
            pane_id,
            persistence,
        )),
        copy_event_id,
    )
}

fn author_context_callback(
    runtime: RuntimeSignal,
    sequence: TabSequence,
    pane_id: String,
    persistence: Option<WorkspacePersistence>,
) -> Callback<(String, String)> {
    Callback::new(move |(event_id, pubkey)| {
        let option = author_context_option(event_id, pubkey);
        if let Some(tab_id) = matching_author_context(runtime, &pane_id, &option.config) {
            state::focus(runtime, pane_id.clone(), tab_id, persistence.clone(), 1);
            return;
        }
        state::open_option(
            runtime,
            sequence,
            Some(pane_id.clone()),
            option,
            persistence.clone(),
            1,
        );
    })
}

fn matching_author_context(
    runtime: RuntimeSignal,
    pane_id: &str,
    config: &BTreeMap<String, String>,
) -> Option<String> {
    let event_id = config.get("eventId")?;
    state::pane_tabs(runtime, pane_id)
        .into_iter()
        .find(|tab| {
            tab.kind == TabKind::AuthorContext && tab.config.get("eventId") == Some(event_id)
        })
        .map(|tab| tab.id)
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
mod tests {
    use leptos::prelude::{Callable, GetUntracked, RwSignal};

    use super::*;

    #[test]
    fn nearby_author_context_callback_opens_event_tab() -> Result<(), &'static str> {
        let runtime =
            RwSignal::new(lkjstr_app::start_workspace(crate::app::default_startup_input()).state);
        let sequence = RwSignal::new(0);
        let callback =
            author_context_callback(runtime, sequence, "bootstrap-welcome-pane".to_owned(), None);

        callback.run(("event-a".to_owned(), "pubkey-a".to_owned()));

        let workspace = runtime.get_untracked().workspace;
        let tab = workspace
            .tabs
            .get("rust-author-context-1")
            .ok_or("missing author context tab")?;
        assert_eq!(tab.kind, TabKind::AuthorContext);
        assert_eq!(
            tab.config.get("eventId").map(String::as_str),
            Some("event-a")
        );
        assert_eq!(
            tab.config.get("pubkey").map(String::as_str),
            Some("pubkey-a")
        );
        Ok(())
    }
}
