use std::collections::BTreeMap;

use leptos::prelude::*;
use lkjstr_domain::{NewTabOption, TabKind};

use crate::app::RuntimeSignal;
use crate::workspace::persistence::WorkspacePersistence;
use crate::workspace::state::{self, TabSequence};
use crate::workspace::tab_content_input::TabContentInput;
use crate::workspace::thread;

pub(crate) fn thread_tab_content(input: TabContentInput) -> impl IntoView {
    let open_thread = open_thread_callback(
        input.runtime,
        input.sequence,
        input.pane_id.clone(),
        input.persistence.clone(),
    );
    thread::thread_tab_content(
        input.tab_id,
        input.thread_event_id,
        input.thread_feed,
        input.thread_feed_provider,
        Some(open_thread),
    )
}

fn open_thread_callback(
    runtime: RuntimeSignal,
    sequence: TabSequence,
    pane_id: String,
    persistence: Option<WorkspacePersistence>,
) -> Callback<String> {
    Callback::new(move |event_id| {
        state::open_option(
            runtime,
            sequence,
            Some(pane_id.clone()),
            thread_option(event_id),
            persistence.clone(),
            1,
        );
    })
}

fn thread_option(event_id: String) -> NewTabOption {
    NewTabOption {
        kind: TabKind::Thread,
        label: "Thread",
        description: "Thread continuation.",
        aliases: &[],
        config: BTreeMap::from([("eventId".to_owned(), event_id)]),
    }
}

#[cfg(test)]
mod tests {
    use leptos::prelude::{Callable, GetUntracked, RwSignal};

    use super::*;

    #[test]
    fn continuation_callback_opens_configured_thread_tab() -> Result<(), &'static str> {
        let runtime =
            RwSignal::new(lkjstr_app::start_workspace(crate::app::default_startup_input()).state);
        let sequence = RwSignal::new(0);
        let callback =
            open_thread_callback(runtime, sequence, "bootstrap-welcome-pane".to_owned(), None);

        callback.run("target-event".to_owned());

        let workspace = runtime.get_untracked().workspace;
        let tab = workspace
            .tabs
            .get("rust-thread-1")
            .ok_or("missing continuation thread tab")?;
        assert_eq!(tab.kind, TabKind::Thread);
        assert_eq!(
            tab.config.get("eventId").map(String::as_str),
            Some("target-event")
        );
        assert_eq!(workspace.focused_tab_id.as_deref(), Some("rust-thread-1"));
        Ok(())
    }
}
