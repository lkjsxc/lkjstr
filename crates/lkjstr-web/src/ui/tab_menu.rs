//! Tab menu and filtered all-tabs list; anchored to the owning tile.
use super::{Ui, pane::tab_title};
use leptos::prelude::*;
use lkjstr_core::layout::{self, TabId, Zone};

#[component]
pub fn TabMenu(tab: TabId, shown: RwSignal<bool>) -> impl IntoView {
    let ui = Ui::get();
    let run = move |action: fn(&mut lkjstr_core::Workspace, TabId)| {
        shown.set(false);
        ui.ws.update(|ws| action(ws, tab));
        crate::host::after(0, || {
            crate::host::focus_selector(".pane.focused .tab.active")
        });
    };
    view! {
        <div class="menu tab-menu" role="menu" aria-label="Tab actions" on:keydown=move |ev: web_sys::KeyboardEvent| { if ev.key() == "Escape" { shown.set(false); } }>
            <button role="menuitem" on:click=move |_| { shown.set(false); ui.close_tab(tab); }>"Close"<kbd>"Alt+W"</kbd></button>
            <button role="menuitem" on:click=move |_| run(|ws,t| ws.close_others(t,false))>{move || ui.tr("Close others")}</button>
            <button role="menuitem" on:click=move |_| run(|ws,t| ws.close_others(t,true))>{move || ui.tr("Close to the right")}</button>
            <button role="menuitem" on:click=move |_| run(|ws,t| { ws.duplicate(t); })>{move || ui.tr("Duplicate")}</button>
            <details><summary>{move || ui.tr("Move to workspace")}</summary>{(0..9).map(|index| view! { <button role="menuitem" on:click=move |_| { shown.set(false); super::spaces::move_tab(ui,tab,index); }>{format!("Workspace {}",index+1)}<kbd>{format!("Ctrl+Alt+Shift+{}",index+1)}</kbd></button> }).collect_view()}</details>
            <button role="menuitem" on:click=move |_| run(|ws,t| ws.keep(t))>{move || ui.tr("Keep")}<kbd>"Enter"</kbd></button>
            <button role="menuitem" on:click=move |_| run(|ws,t| ws.pin(t))>{move || if ui.ws.with(|ws| ws.navigation.pinned.contains(&tab)) { "Unpin" } else { "Pin" }}</button>
            <button role="menuitem" on:click=move |_| { shown.set(false); ui.ws.update(|ws| ws.activate(tab)); ui.command(lkjstr_core::Command::Split(Zone::Right)); }>{move || ui.tr("Split right")}<kbd>"Alt+\\"</kbd></button>
            <button role="menuitem" on:click=move |_| { shown.set(false); ui.ws.update(|ws| ws.activate(tab)); ui.command(lkjstr_core::Command::Split(Zone::Bottom)); }>{move || ui.tr("Split down")}<kbd>"Alt+-"</kbd></button>
            <button role="menuitem" on:click=move |_| {
                shown.set(false);
                if let Some(view) = ui.ws.with_untracked(|ws| ws.tabs.get(&tab).cloned()) {
                    let hash = lkjstr_core::route::encode(&view);
                    if let Some(window) = web_sys::window() {
                        let location = window.location();
                        let url = format!("{}{}#view={}", location.origin().unwrap_or_default(), location.pathname().unwrap_or_default(), js_sys::encode_uri_component(&hash));
                        let _ = window.navigator().clipboard().write_text(&url);
                    }
                }
            }>"Copy link"</button>
        </div>
    }
}

#[component]
pub fn AllTabs(pane: u32, shown: RwSignal<bool>) -> impl IntoView {
    let ui = Ui::get();
    let filter = RwSignal::new(String::new());
    view! {
        <div class="menu all-tabs" role="menu" aria-label="All tabs">
            <input type="search" aria-label="Filter tabs" placeholder="Filter tabs" on:input=move |ev| filter.set(event_target_value(&ev))/>
            {move || ui.ws.with(|ws| layout::find_pane(&ws.root,pane).map(|p| p.tabs.clone()).unwrap_or_default()).into_iter()
                .filter(|t| tab_title(ui,*t).to_lowercase().contains(&filter.get().to_lowercase()))
                .map(|tab| view! { <button role="menuitem" on:click=move |_| { ui.ws.update(|ws| ws.activate(tab)); shown.set(false); }>{move || tab_title(ui,tab)}</button> }).collect_view()}
        </div>
    }
}
