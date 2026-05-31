use leptos::prelude::*;
use lkjstr_app::{StartupInput, WorkspaceRuntimeState, default_recovery_ids, start_workspace};

use crate::workspace::WorkspaceShell;

#[component]
pub fn App() -> impl IntoView {
    let startup = start_workspace(StartupInput {
        stored_workspace: None,
        storage_available: true,
        recovery_ids: default_recovery_ids("main"),
        now: 0,
    });
    let runtime = RwSignal::new(startup.state);

    view! {
        <WorkspaceShell runtime=runtime />
    }
}

pub type RuntimeSignal = RwSignal<WorkspaceRuntimeState>;
