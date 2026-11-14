//! App shell: boot, context, top bar, workspace, help overlay.

use leptos::ev;
use leptos::prelude::*;
use lkjstr_core::Workspace;

use super::text::short_npub;
use super::{Settings, Theme, Ui, keys, tiles};
use crate::host::{after, set_root_attr};
use crate::runtime::App;
use crate::runtime::status::Summary;

const NARROW_PX: f64 = 760.0;

fn window_width() -> f64 {
    web_sys::window()
        .and_then(|w| w.inner_width().ok())
        .and_then(|w| w.as_f64())
        .unwrap_or(1280.0)
}

#[component]
pub fn Shell() -> impl IntoView {
    let app = App::new();
    let ui = Ui {
        app,
        ws: RwSignal::new(Workspace::preset(false)),
        settings: RwSignal::new(Settings::default()),
        narrow: RwSignal::new(window_width() < NARROW_PX),
        help: RwSignal::new(false),
        page_visible: RwSignal::new(!crate::host::document_hidden()),
    };
    provide_context(ui);
    let booted = RwSignal::new(false);
    app.boot(move |boot| {
        let signed_in = app.with(|rt| rt.session.active.is_some());
        let stored = boot
            .workspace
            .and_then(|text| serde_json::from_str::<Workspace>(&text).ok())
            .map(|ws| ws.repaired(signed_in));
        ui.ws
            .set(stored.unwrap_or_else(|| Workspace::preset(signed_in)));
        if let Some(settings) = boot.settings.and_then(|t| serde_json::from_str(&t).ok()) {
            ui.settings.set(settings);
        }
        booted.set(true);
    });
    persist_workspace(ui, booted);
    Effect::new(move |_| {
        let settings = ui.settings.get();
        let theme = match settings.theme {
            Theme::System => "system",
            Theme::Light => "light",
            Theme::Dark => "dark",
        };
        set_root_attr("data-theme", theme);
        set_root_attr("style", &format!("--text: {}px", settings.text));
        if booted.get_untracked()
            && let Ok(text) = serde_json::to_string(&settings)
        {
            app.kv_put("settings", &text);
        }
    });
    let resize = window_event_listener(ev::resize, move |_| {
        ui.narrow.set(window_width() < NARROW_PX)
    });
    let keydown = window_event_listener(ev::keydown, move |event| keys::handle(ui, &event));
    let shown = window_event_listener(ev::visibilitychange, move |_| {
        ui.page_visible.set(!crate::host::document_hidden());
    });
    on_cleanup(move || {
        resize.remove();
        keydown.remove();
        shown.remove();
    });
    view! {
        <div class="app" class:narrow=move || ui.narrow.get()>
            <TopBar/>
            <main class="desk" aria-label="Workspace">
                <Show
                    when=move || booted.get()
                    fallback=|| view! { <p class="boot">"Opening local data…"</p> }
                >
                    {tiles::Desk}
                </Show>
            </main>
            <Show when=move || ui.help.get()>
                <keys::Help/>
            </Show>
        </div>
    }
}

/// Saves the layout shortly after each change.
fn persist_workspace(ui: Ui, booted: RwSignal<bool>) {
    let pending = StoredValue::new(false);
    Effect::new(move |_| {
        ui.ws.track();
        if !booted.get() || pending.get_value() {
            return;
        }
        pending.set_value(true);
        after(400, move || {
            pending.set_value(false);
            if let Ok(text) = ui.ws.with_untracked(serde_json::to_string) {
                ui.app.kv_put("workspace", &text);
            }
        });
    });
}

#[component]
fn TopBar() -> impl IntoView {
    let ui = Ui::get();
    let app = ui.app;
    let summary = Memo::new(move |_| {
        app.net_rev.track();
        app.rev.track();
        app.with(|rt| rt.summary())
    });
    let account = Memo::new(move |_| {
        app.session_rev.track();
        app.rev.track();
        app.with(|rt| {
            let pubkey = rt.session.active.clone()?;
            let label = rt
                .store
                .profile(&pubkey)
                .and_then(|p| p.label().map(str::to_owned));
            Some(label.unwrap_or_else(|| short_npub(&pubkey)))
        })
    });
    let open_relays = move |_| {
        ui.open(lkjstr_core::View::Relays, lkjstr_core::Open::Here);
    };
    let open_accounts = move |_| {
        ui.open(lkjstr_core::View::Accounts, lkjstr_core::Open::Here);
    };
    view! {
        <header class="topbar">
            <span class="brand">"lkjstr"</span>
            <button class="status" on:click=open_relays title="Relays and sync (opens Relays)">
                {move || status_text(summary.get())}
            </button>
            <span class="spacer"></span>
            <button class="ghost" on:click=move |_| ui.help.update(|h| *h = !*h) title="Keyboard shortcuts (?)">
                "Shortcuts"
            </button>
            <button class="account" on:click=open_accounts title="Accounts">
                {move || account.get().unwrap_or_else(|| "Sign in".to_owned())}
            </button>
        </header>
    }
}

fn status_text(summary: Summary) -> String {
    let relays = match (summary.open, summary.connecting) {
        (0, 0) if summary.failing > 0 => "offline".to_owned(),
        (0, 0) => "idle".to_owned(),
        (open, 0) => format!("{open} relays"),
        (open, connecting) => format!("{open} relays, {connecting} connecting"),
    };
    if summary.waiting > 0 || summary.queued_events > 0 {
        format!("● {relays} · syncing")
    } else {
        format!("● {relays}")
    }
}
