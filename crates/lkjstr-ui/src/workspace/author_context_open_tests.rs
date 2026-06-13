use leptos::prelude::{Callable, GetUntracked, RwSignal};
use lkjstr_domain::TabKind;

use super::*;

#[test]
fn thread_action_opens_or_focuses_matching_event_tab() -> Result<(), &'static str> {
    let runtime = runtime();
    let callback = event_tab_callback(
        runtime,
        RwSignal::new(0),
        "bootstrap-welcome-pane".to_owned(),
        None,
        TabKind::Thread,
    );

    callback.run("target-event".to_owned());
    callback.run("target-event".to_owned());

    assert_single_event_tab(runtime, TabKind::Thread, "target-event")
}

#[test]
fn author_context_action_opens_or_focuses_matching_event_tab() -> Result<(), &'static str> {
    let runtime = runtime();
    let callback = author_context_callback(
        runtime,
        RwSignal::new(0),
        "bootstrap-welcome-pane".to_owned(),
        None,
    );

    callback.run(("target-event".to_owned(), "a".repeat(64)));
    callback.run(("target-event".to_owned(), "a".repeat(64)));

    assert_single_event_tab(runtime, TabKind::AuthorContext, "target-event")
}

fn assert_single_event_tab(
    runtime: RuntimeSignal,
    kind: TabKind,
    event_id: &str,
) -> Result<(), &'static str> {
    let workspace = runtime.get_untracked().workspace;
    let tabs = workspace
        .tabs
        .values()
        .filter(|tab| tab.kind == kind)
        .collect::<Vec<_>>();
    let tab = tabs.first().ok_or("missing event tab")?;
    assert_eq!(tabs.len(), 1);
    assert_eq!(
        tab.config.get("eventId").map(String::as_str),
        Some(event_id)
    );
    assert_eq!(workspace.focused_tab_id.as_deref(), Some(tab.id.as_str()));
    Ok(())
}

fn runtime() -> RuntimeSignal {
    RwSignal::new(lkjstr_app::start_workspace(crate::app::default_startup_input()).state)
}
