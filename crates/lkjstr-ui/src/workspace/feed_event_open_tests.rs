use leptos::prelude::{Callable, GetUntracked, RwSignal};

use super::*;

#[test]
fn nearby_actions_open_profile_and_thread_tabs() -> Result<(), &'static str> {
    let runtime = runtime();
    let actions = nearby_event_actions(
        runtime,
        RwSignal::new(0),
        "bootstrap-welcome-pane".to_owned(),
        None,
        None,
    );

    actions
        .profile_opener()
        .ok_or("missing profile opener")?
        .run("pubkey-a".to_owned());
    assert_tab(runtime, TabKind::Profile, "pubkey", "pubkey-a")?;

    actions
        .thread_opener()
        .ok_or("missing thread opener")?
        .run("event-a".to_owned());

    assert_tab(runtime, TabKind::Thread, "eventId", "event-a")
}

#[test]
fn nearby_author_context_callback_opens_event_tab() -> Result<(), &'static str> {
    let runtime = runtime();
    let callback = author_context_callback(
        runtime,
        RwSignal::new(0),
        "bootstrap-welcome-pane".to_owned(),
        None,
    );

    callback.run(("event-a".to_owned(), "pubkey-a".to_owned()));

    assert_tab(runtime, TabKind::AuthorContext, "eventId", "event-a")?;
    assert_tab(runtime, TabKind::AuthorContext, "pubkey", "pubkey-a")
}

#[test]
fn nearby_author_context_callback_reuses_existing_event_tab() -> Result<(), &'static str> {
    let runtime = runtime();
    let callback = author_context_callback(
        runtime,
        RwSignal::new(0),
        "bootstrap-welcome-pane".to_owned(),
        None,
    );

    callback.run(("event-a".to_owned(), "pubkey-a".to_owned()));
    callback.run(("event-b".to_owned(), "pubkey-b".to_owned()));
    callback.run(("event-a".to_owned(), "pubkey-a".to_owned()));

    let workspace = runtime.get_untracked().workspace;
    let author_context_tabs = workspace
        .tabs
        .values()
        .filter(|tab| tab.kind == TabKind::AuthorContext)
        .count();
    assert_eq!(author_context_tabs, 2);
    assert_eq!(
        workspace.focused_tab_id.as_deref(),
        Some("rust-author-context-1")
    );
    Ok(())
}

fn runtime() -> RuntimeSignal {
    RwSignal::new(lkjstr_app::start_workspace(crate::app::default_startup_input()).state)
}

fn assert_tab(
    runtime: RuntimeSignal,
    kind: TabKind,
    key: &str,
    value: &str,
) -> Result<(), &'static str> {
    let workspace = runtime.get_untracked().workspace;
    let tab = workspace
        .tabs
        .values()
        .find(|tab| tab.kind == kind && tab.config.get(key).map(String::as_str) == Some(value))
        .ok_or("missing tab")?;
    assert_eq!(workspace.focused_tab_id.as_deref(), Some(tab.id.as_str()));
    Ok(())
}
