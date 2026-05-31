use leptos::prelude::*;
use lkjstr_app::{focus_runtime_tab, open_runtime_tab};
use lkjstr_domain::{NewTabIds, PaneNode, TabKind, WorkspaceTab, new_tab_options_for_account};

use crate::app::RuntimeSignal;

#[component]
pub fn WorkspaceShell(runtime: RuntimeSignal) -> impl IntoView {
    let next_tab = RwSignal::new(0_u64);
    let open_new_tab = move |_| {
        let index = next_tab.get_untracked() + 1;
        next_tab.set(index);
        runtime.update(|state| {
            *state = open_runtime_tab(
                state.clone(),
                None,
                TabKind::NewTab,
                NewTabIds {
                    tab_id: format!("rust-new-tab-{index}"),
                },
                index,
            );
        });
    };

    view! {
        <main class="lkjstr-shell" data-testid="rust-workspace-shell">
            <header class="lkjstr-activity-bar">
                <strong>"lkjstr"</strong>
                <button type="button" on:click=open_new_tab aria-label="New tab">"+"</button>
            </header>
            <section class="lkjstr-pane-grid">
                {move || pane_ids(runtime).into_iter().map(|pane| {
                    view! { <PaneView runtime=runtime pane=pane /> }
                }).collect_view()}
            </section>
        </main>
    }
}

#[component]
fn PaneView(runtime: RuntimeSignal, pane: PaneNode) -> impl IntoView {
    let pane_id = pane.id.clone();
    let pane_attr = pane.id.clone();
    let tabs_pane_id = pane.id.clone();
    let body_pane_id = pane.id;
    let title = move || active_title(runtime, &pane_id);
    view! {
        <article class="lkjstr-pane" data-pane-id=pane_attr>
            <div class="lkjstr-pane-head">
                <span class="lkjstr-pane-title">{title}</span>
                <button type="button" aria-label="Pane menu">"..."</button>
            </div>
            <nav class="lkjstr-tab-strip" aria-label="Tabs">
                {move || {
                    let pane_id = tabs_pane_id.clone();
                    pane_tabs(runtime, &pane_id).into_iter().map(move |tab| {
                    let selected_tab_id = tab.id.clone();
                    let focus_tab_id = tab.id.clone();
                    let focus_pane_id = pane_id.clone();
                    let selected = move || is_focused(runtime, &selected_tab_id);
                    let focus = move |_| {
                        runtime.update(|state| {
                            *state =
                                focus_runtime_tab(state.clone(), &focus_pane_id, &focus_tab_id, 1);
                        });
                    };
                    view! {
                        <button
                            type="button"
                            class:active=selected
                            on:click=focus
                        >
                            {tab.title}
                        </button>
                    }
                }).collect_view()
                }}
            </nav>
            <section class="lkjstr-pane-body">
                {move || active_tab(runtime, &body_pane_id).into_iter().map(tab_body).collect_view()}
            </section>
        </article>
    }
}

fn tab_body(tab: WorkspaceTab) -> impl IntoView {
    let description = match tab.kind {
        TabKind::Welcome => "Rust workspace startup is active.",
        TabKind::NewTab => "Choose a real workspace surface.",
        TabKind::Timeline => "Home timeline surface.",
        TabKind::Notifications => "Notifications surface.",
        TabKind::Tweet => "Tweet composer surface.",
        _ => "Workspace surface.",
    };
    view! {
        <div class="lkjstr-tab-body">
            <h1>{tab.title}</h1>
            <p>{description}</p>
            <NewTabMenu visible=matches!(tab.kind, TabKind::NewTab) />
        </div>
    }
}

#[component]
fn NewTabMenu(visible: bool) -> impl IntoView {
    let options = new_tab_options_for_account(None);
    view! {
        <div class:hidden=!visible class="lkjstr-new-tab-menu">
            {options.into_iter().map(|option| view! {
                <button type="button">
                    <span>{option.label}</span>
                    <small>{option.description}</small>
                </button>
            }).collect_view()}
        </div>
    }
}

fn pane_ids(runtime: RuntimeSignal) -> Vec<PaneNode> {
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

fn pane_tabs(runtime: RuntimeSignal, pane_id: &str) -> Vec<WorkspaceTab> {
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

fn active_tab(runtime: RuntimeSignal, pane_id: &str) -> Option<WorkspaceTab> {
    pane_tabs(runtime, pane_id)
        .into_iter()
        .find(|tab| is_focused(runtime, &tab.id))
        .or_else(|| pane_tabs(runtime, pane_id).into_iter().next())
}

fn active_title(runtime: RuntimeSignal, pane_id: &str) -> String {
    active_tab(runtime, pane_id)
        .map(|tab| tab.title)
        .unwrap_or_else(|| "Workspace".to_owned())
}

fn is_focused(runtime: RuntimeSignal, tab_id: &str) -> bool {
    runtime.with(|state| state.workspace.focused_tab_id.as_deref() == Some(tab_id))
}
