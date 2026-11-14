//! Workspace selection shares one runtime and pauses wants on hidden desks.
use super::Ui;
use leptos::prelude::*;

pub fn select(ui: Ui, index: usize) {
    let current = ui.ws.get_untracked();
    let mut next = None;
    ui.spaces.update(|spaces| {
        spaces.seen[spaces.active] = crate::host::now_secs();
        next = spaces.switch(&current, index);
        spaces.seen[spaces.active] = crate::host::now_secs();
    });
    if let Some(next) = next {
        ui.zoom.set(None);
        ui.ws.set(next);
        crate::host::after(0, || {
            crate::host::focus_selector(".pane.focused .tab.active")
        });
    }
}
pub fn move_tab(ui: Ui, tab: u32, index: usize) {
    let mut current = ui.ws.get_untracked();
    ui.spaces.update(|spaces| {
        spaces.move_tab(&mut current, tab, index);
    });
    ui.ws.set(current);
}
#[component]
pub fn Switcher() -> impl IntoView {
    let ui = Ui::get();
    view! {
        <nav class="workspaces" aria-label="Workspaces">
            {(0..9).map(|index| view! {
                <button class:active=move || ui.spaces.with(|s| s.active==index)
                    data-workspace=index
                    aria-label=move || ui.spaces.with(|s| s.names[index].clone())
                    title=move || format!("{} (Alt+Shift+{})",ui.spaces.with(|s| s.names[index].clone()),index+1)
                    on:click=move |_| select(ui,index)>{index+1}<Show when=move || unseen(ui,index)><span class="unseen-dot" aria-label="Unseen activity"></span></Show></button>
            }).collect_view()}
        </nav>
    }
}

fn unseen(ui: Ui, index: usize) -> bool {
    ui.app.rev.track();
    ui.app.session_rev.track();
    let spaces = ui.spaces.get();
    if spaces.active == index {
        return false;
    }
    ui.app.with(|rt| {
        let Some(me) = rt.session.active.as_ref() else {
            return false;
        };
        let views = &spaces.desks[index].tabs;
        let mut authors = rt.store.follows(me).unwrap_or_default();
        authors.push(me.clone());
        views.values().any(|view| {
            let query = match view {
                lkjstr_core::View::Home => lkjstr_core::store::Query {
                    authors: Some(authors.iter().cloned().collect()),
                    kinds: vec![1, 6],
                    limit: 1,
                    ..Default::default()
                },
                lkjstr_core::View::Notifications => lkjstr_core::store::Query {
                    mention: Some(me.clone()),
                    exclude_author: Some(me.clone()),
                    kinds: vec![1, 6, 7, 9735],
                    limit: 1,
                    ..Default::default()
                },
                _ => return false,
            };
            rt.store
                .feed(&query)
                .first()
                .is_some_and(|e| e.created_at > spaces.seen[index])
        })
    })
}

/// Other browser tabs receive layout edits without changing their chosen desk.
pub fn install_sync(ui: Ui) {
    let listener = window_event_listener(leptos::ev::storage, move |event| {
        if event.key().as_deref() != Some("lkjstr-layout-sync") {
            return;
        }
        let Some((index, workspace)) = event
            .new_value()
            .and_then(|s| serde_json::from_str::<(usize, lkjstr_core::Workspace)>(&s).ok())
        else {
            return;
        };
        if index >= 9 {
            return;
        }
        let signed_in = ui.app.with(|rt| rt.session.active.is_some());
        let workspace = workspace.repaired(signed_in);
        let mut spaces = ui.spaces.get_untracked();
        let active = spaces.active;
        spaces.desks[active] = ui.ws.get_untracked();
        if spaces.install(index, workspace) {
            ui.ws.set(spaces.desks[active].clone());
            ui.spaces.set(spaces);
        }
    });
    on_cleanup(move || listener.remove());
}

pub fn broadcast(ui: Ui) {
    let index = ui.spaces.with_untracked(|s| s.active);
    if let Some(storage) = web_sys::window().and_then(|w| w.local_storage().ok().flatten())
        && let Ok(text) = serde_json::to_string(&(index, ui.ws.get_untracked()))
    {
        // Setting an identical value emits no storage event, terminating echoes.
        let _ = storage.set_item("lkjstr-layout-sync", &text);
    }
}
