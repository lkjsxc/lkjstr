//! One tile: tab strip (drag, close, +, menu) and the bodies of its tabs.
//! Inactive bodies stay mounted (scroll position survives) but hidden, and
//! their views stop asking the network for anything.

use leptos::prelude::*;
use lkjstr_core::layout::{self, NodeId, TabId, Zone};
use lkjstr_core::{Command, View, Workspace};

use super::text::short_npub;
use super::{Ui, drag, views};

pub(super) fn tab_title(ui: Ui, tab: TabId) -> String {
    let view = ui.ws.with(|ws| ws.tabs.get(&tab).cloned());
    let Some(view) = view else {
        return String::new();
    };
    let name = |pubkey: &str| {
        ui.app.rev.track();
        ui.app
            .with(|rt| {
                rt.store
                    .profile(pubkey)
                    .and_then(|p| p.label().map(str::to_owned))
            })
            .unwrap_or_else(|| short_npub(pubkey))
    };
    match &view {
        View::Profile { pubkey } => name(pubkey),
        View::Thread { id, .. } => {
            let author = ui.app.with(|rt| rt.store.get(id).map(|e| e.pubkey.clone()));
            author.map_or_else(
                || "Thread".to_owned(),
                |pk| format!("Thread · {}", name(&pk)),
            )
        }
        View::Search { query } if !query.is_empty() => format!("Search · {query}"),
        other => ui.tr(other.title()),
    }
}

#[component]
pub fn PaneView(id: NodeId) -> impl IntoView {
    let ui = Ui::get();
    let pane = Memo::new(move |_| ui.ws.with(|ws| layout::find_pane(&ws.root, id).cloned()));
    let tabs =
        Memo::new(move |_| pane.with(|p| p.as_ref().map(|p| p.tabs.clone()).unwrap_or_default()));
    let active = Memo::new(move |_| pane.with(|p| p.as_ref().map(|p| p.active)));
    let focused = Memo::new(move |_| ui.ws.with(|ws| ws.focus == id));
    let menu = RwSignal::new(false);
    let all_tabs = RwSignal::new(false);
    let strip = NodeRef::<leptos::html::Div>::new();
    let tab_width = RwSignal::new(None::<f64>);
    let focus = move || {
        if !focused.get_untracked() {
            ui.ws.update(|ws| ws.focus = id);
        }
    };
    let add = move |_| {
        focus();
        ui.ws.update(|ws| ws.apply(Command::NewTab));
    };
    let run = move |edit: fn(&mut Workspace, NodeId)| {
        menu.set(false);
        focus();
        ui.ws.update(|ws| edit(ws, id));
    };
    view! {
        <section
            class="pane"
            class:focused=move || focused.get()
            class:zoomed=move || ui.zoom.get() == Some(id)
            data-pane=id
            on:pointerdown=move |_| focus()
            on:focusin=move |_| focus()
        >
            <div class="strip" role="tablist" aria-label="Tabs"
                style=move || tab_width.get().map(|w| format!("--closing-width:{w}px")).unwrap_or_default()
                on:pointerleave=move |_| tab_width.set(None)
                on:wheel=move |ev: web_sys::WheelEvent| { if let Some(el) = strip.get() && el.scroll_width() > el.client_width() { ev.prevent_default(); el.set_scroll_left(el.scroll_left() + ev.delta_y() as i32); } }
                on:dblclick=move |ev| { if ev.target().and_then(|t| wasm_bindgen::JsCast::dyn_into::<web_sys::Element>(t).ok()).is_some_and(|e| e.class_list().contains("strip") || e.class_list().contains("tab-scroll")) { ui.ws.update(|ws| { ws.focus=id; ws.apply(Command::NewTab); }); } }
                on:auxclick=move |ev: web_sys::MouseEvent| { if ev.button()==1 { ev.prevent_default(); if ev.target().and_then(|t| wasm_bindgen::JsCast::dyn_into::<web_sys::Element>(t).ok()).is_some_and(|e| e.class_list().contains("strip") || e.class_list().contains("tab-scroll")) { ui.ws.update(|ws| { ws.focus=id; ws.apply(Command::NewTab); }); } } }
            >
                <div class="tab-scroll" node_ref=strip style=move || format!("--tab-count:{}",tabs.with(|t| t.len().max(1)))>
                <For each=move || tabs.get() key=|tab| *tab let:tab>
                    <TabChip tab=tab frozen=tab_width selected=Signal::derive(move || active.get() == Some(tab))/>
                </For>
                </div>
                <button class="icon" title="New tab (Alt+T)" aria-label="New tab" on:click=add><super::icons::Icon name="plus"/></button>
                <span class="strip-fill" on:dblclick=move |_| ui.ws.update(|ws| { ws.focus=id; ws.apply(Command::NewTab); }) on:auxclick=move |ev: web_sys::MouseEvent| { if ev.button()==1 { ev.prevent_default(); ui.ws.update(|ws| { ws.focus=id; ws.apply(Command::NewTab); }); } }></span>
                <button class="icon" title="All tabs" aria-label="All tabs" on:click=move |_| all_tabs.update(|v| *v = !*v)><super::icons::Icon name="list"/></button>
                <Show when=move || all_tabs.get()><super::tab_menu::AllTabs pane=id shown=all_tabs/></Show>
                <button class="icon" title="Tile menu" aria-label="Tile menu" aria-expanded=move || menu.get().to_string() on:click=move |_| menu.update(|m| *m = !*m)><super::icons::Icon name="more"/></button>
                <Show when=move || menu.get()>
                    <div class="menu" role="menu" on:pointerleave=move |_| menu.set(false)>
                        <button role="menuitem" on:click=move |_| { menu.set(false); focus(); ui.command(Command::Split(Zone::Right)); }>{move || ui.tr("Split right")}<kbd>"Alt+\\"</kbd></button>
                        <button role="menuitem" on:click=move |_| { menu.set(false); focus(); ui.command(Command::Split(Zone::Bottom)); }>{move || ui.tr("Split down")}<kbd>"Alt+-"</kbd></button>
                        <button role="menuitem" on:click=move |_| run(|ws, _| ws.apply(Command::Grow(2)))>{move || ui.tr("Widen")}<kbd>"Alt+."</kbd></button>
                        <button role="menuitem" on:click=move |_| run(|ws, _| ws.apply(Command::Grow(-2)))>{move || ui.tr("Narrow")}<kbd>"Alt+,"</kbd></button>
                        <button role="menuitem" on:click=move |_| run(|ws, pane| ws.close_pane(pane))>{move || ui.tr("Close tile")}</button>
                        <button role="menuitem" on:click=move |_| run(|ws, _| {
                            let signed_in = ws.tabs.values().any(|v| *v == View::Home);
                            ws.reset_to_preset(signed_in);
                        })>{move || ui.tr("Reset layout")}</button>
                    </div>
                </Show>
            </div>
            <div class="bodies">
                <For each=move || tabs.get() key=|tab| *tab let:tab>
                    {
                        let shown = Memo::new(move |_| active.get() == Some(tab));
                        let visible = Signal::derive(move || {
                            shown.get() && (!ui.narrow.get() || focused.get()) && ui.zoom.get().is_none_or(|zoom| zoom == id) && ui.page_visible.get()
                        });
                        view! {
                            <div class="body" class:shown=move || shown.get() role="tabpanel" on:input=move |_| ui.ws.update(|ws| ws.keep(tab))>
                                <views::TabBody tab=tab visible=visible/>
                            </div>
                        }
                    }
                </For>
            </div>
        </section>
    }
}

#[component]
fn TabChip(tab: TabId, selected: Signal<bool>, frozen: RwSignal<Option<f64>>) -> impl IntoView {
    let ui = Ui::get();
    let title = Memo::new(move |_| tab_title(ui, tab));
    let entered = StoredValue::new(false);
    let menu = RwSignal::new(false);
    let chip = NodeRef::<leptos::html::Div>::new();
    Effect::new(move |_| {
        if selected.get()
            && let Some(el) = chip.get()
        {
            el.scroll_into_view_with_bool(false);
        }
    });
    let down = move |ev: web_sys::PointerEvent| {
        drag::start_tab_drag(ev, ui, tab, title.get_untracked());
    };
    let close = move |ev: web_sys::MouseEvent| {
        ev.stop_propagation();
        if let Some(el) = chip.get_untracked() {
            frozen.set(Some(el.get_bounding_client_rect().width()));
        }
        ui.close_tab(tab);
        crate::host::after(0, || {
            crate::host::focus_selector(".pane.focused .tab.active")
        });
    };
    view! {
        <div
            class="tab" node_ref=chip data-tab=tab
            class:pinned=move || ui.ws.with(|ws| ws.navigation.pinned.contains(&tab))
            on:contextmenu=move |ev| { ev.prevent_default(); menu.set(true); }
            on:auxclick=move |ev: web_sys::MouseEvent| { if ev.button()==1 { ev.prevent_default(); ev.stop_propagation(); if ui.settings.get_untracked().middle_close { close(ev); } } }
            on:mousedown=move |ev: web_sys::MouseEvent| { if ev.button()==1 { ev.prevent_default(); } }
            class:active=move || selected.get()
            class:preview=move || ui.ws.with(|ws| ws.navigation.previews.contains(&tab))
            on:dblclick=move |_| ui.ws.update(|ws| ws.keep(tab))
            role="tab"
            tabindex="0"
            aria-selected=move || selected.get().to_string()
            title=move || title.get()
            on:pointerdown=down
            on:keydown=move |ev: web_sys::KeyboardEvent| {
                if ev.key() == "Enter" || ev.key() == " " {
                    ui.ws.update(|ws| { if entered.get_value() && selected.get_untracked() { ws.keep(tab); } ws.activate(tab); });
                    entered.set_value(true);
                }
            }
        >
            {move || view! { <super::icons::Icon name=ui.ws.with(|ws| ws.tabs.get(&tab).map_or("plus", View::icon))/> }}
            <span class="tab-title">{move || title.get()}</span>
            <button
                class="x"
                aria-label="Close tab"
                title="Close tab (Alt+W)"
                on:pointerdown=|ev: web_sys::PointerEvent| ev.stop_propagation()
                on:click=close
            ><super::icons::Icon name="close"/></button>
        </div>
        <Show when=move || menu.get()><super::tab_menu::TabMenu tab=tab shown=menu/></Show>
    }
}
