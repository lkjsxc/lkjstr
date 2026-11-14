//! Desktop frame, account menu, command/search entry and phone navigation.
use super::{Ui, icons::Icon, note_parts::Avatar};
use leptos::prelude::*;
use lkjstr_core::{Open, View, launcher_choices};

#[component]
pub fn TopBar() -> impl IntoView {
    let ui = Ui::get();
    let menu = RwSignal::new(false);
    let account = Memo::new(move |_| {
        ui.app.session_rev.track();
        ui.app.with(|rt| rt.session.active.clone())
    });
    let status = move || {
        ui.app.net_rev.track();
        let s = ui.app.with(|rt| rt.summary());
        if !ui.online.get() || (s.open == 0 && s.failing > 0) {
            ui.tr("offline, showing cache")
        } else if s.connecting > 0 {
            format!("{} {} · {}", s.open, ui.tr("relays"), ui.tr("connecting"))
        } else {
            format!("{} {}", s.open, ui.tr("relays"))
        }
    };
    view! {
        <header class="topbar">
            <span class="brand">"lkjstr"</span>
            <button class="status" title="Relays" on:click=move |_| { ui.open(View::Relays, Open::Here); }>{status}</button>
            <super::spaces::Switcher/>
            <span class="spacer"></span>
            <button class="palette-trigger desktop-actions" on:click=move |_| ui.palette.set(true) aria-label=move || ui.tr("Search or open a view") title="Search or open a view (Ctrl/Cmd+K)">
                <Icon name="search"/><span class="grow">{move || ui.tr("Search")}</span><kbd>"⌘K"</kbd>
            </button>
            <button class="account desktop-actions" title=move || ui.tr("Accounts") aria-label=move || ui.tr("Accounts") aria-expanded=move || menu.get().to_string() on:click=move |_| menu.update(|m| *m = !*m)>
                {move || match account.get() {
                    Some(pubkey) => view! { <Avatar pubkey=pubkey/> }.into_any(),
                    None => view! { <span class="avatar"><Icon name="user"/></span> }.into_any(),
                }}
            </button>
            <Show when=move || menu.get()><AccountMenu shown=menu/></Show>
        </header>
        <Show when=move || ui.palette.get()><Palette/></Show>
    }
}

#[component]
fn AccountMenu(shown: RwSignal<bool>, #[prop(default = false)] phone: bool) -> impl IntoView {
    let ui = Ui::get();
    let go = move |view| {
        shown.set(false);
        ui.open(view, Open::Here);
    };
    view! {
        <div class="menu" class:more-sheet=phone role="menu" aria-label=move || ui.tr("Accounts")>
            <Show when=move || phone><super::spaces::Switcher/></Show>
            <button role="menuitem" on:click=move |_| go(View::Accounts)>{move || ui.tr("Sign in or create a key")}</button>
            <button role="menuitem" on:click=move |_| go(View::Settings)>{move || ui.tr("Settings")}</button>
            <button role="menuitem" on:click=move |_| go(View::Relays)>{move || ui.tr("Relays")}</button>
            <button role="menuitem" on:click=move |_| { shown.set(false); ui.help.set(true); }>{move || ui.tr("Keyboard shortcuts")}<kbd>"?"</kbd></button>
            <button role="menuitem" on:click=move |_| shown.set(false)>{move || ui.tr("Close")}</button>
        </div>
    }
}

#[component]
pub fn PhoneBar() -> impl IntoView {
    let ui = Ui::get();
    let more = RwSignal::new(false);
    let buttons = [
        ("home", "Home", View::Home),
        (
            "search",
            "Search",
            View::Search {
                query: String::new(),
            },
        ),
        ("compose", "Compose", View::Compose { reply_to: None }),
        ("notifications", "Notifications", View::Notifications),
    ];
    view! {
        <nav class="bottom-bar" aria-label="Navigation">
            {buttons.into_iter().map(|(icon, label, view)| view! {
                <button title=move || ui.tr(label) aria-label=move || ui.tr(label) on:click=move |_| { more.set(false); ui.open(view.clone(), Open::Here); }><Icon name=icon/></button>
            }).collect_view()}
            <button title=move || ui.tr("More") aria-label=move || ui.tr("More") aria-expanded=move || more.get().to_string() on:click=move |_| more.update(|v| *v = !*v)><Icon name="more"/></button>
            <Show when=move || more.get()><AccountMenu shown=more phone=true/></Show>
        </nav>
    }
}

#[component]
fn Palette() -> impl IntoView {
    let ui = Ui::get();
    let query = RwSignal::new(String::new());
    let input = NodeRef::<leptos::html::Input>::new();
    Effect::new(move |_| {
        if let Some(el) = input.get() {
            let _ = el.focus();
        }
    });
    let open_search = move || {
        ui.open(
            View::Search {
                query: query.get_untracked(),
            },
            Open::Here,
        );
        ui.palette.set(false);
    };
    view! {
        <div class="overlay" on:click=move |_| ui.palette.set(false)>
            <div class="sheet palette" role="dialog" aria-label=move || ui.tr("Search or open a view") on:click=|ev| ev.stop_propagation()>
                <input node_ref=input class="wide" type="search" aria-label=move || ui.tr("Search or open a view") placeholder=move || ui.tr("Search or open a view") on:input=move |ev| query.set(event_target_value(&ev)) on:keydown=move |ev: web_sys::KeyboardEvent| { if ev.key() == "Enter" { open_search(); } }/>
                <div class="palette-choices">
                    {move || ui.spaces.get().names.into_iter().enumerate().filter(|(i,name)| { let q=query.get().to_lowercase(); !q.is_empty() && (name.to_lowercase().contains(&q) || (i+1).to_string()==q) }).map(|(index,name)| view! { <button on:click=move |_| { super::spaces::select(ui,index); ui.palette.set(false); }>{format!("{} · {}",index+1,name)}</button> }).collect_view()}
                    {move || launcher_choices().into_iter().filter(|c| ui.tr(c.title).to_lowercase().contains(&query.get().to_lowercase())).map(|c| view! {
                        <button on:click=move |_| { ui.open(c.view.clone(), Open::Here); ui.palette.set(false); }>{ui.tr(c.title)}</button>
                    }).collect_view()}
                </div>
                <button on:click=move |_| open_search()>{move || ui.tr("Search")}</button>
                <button class="ghost" on:click=move |_| ui.palette.set(false)>{move || ui.tr("Close")}</button>
            </div>
        </div>
    }
}
