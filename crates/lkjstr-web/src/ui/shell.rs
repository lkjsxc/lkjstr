//! App shell: boot, context, top bar, workspace, help overlay.

use leptos::ev;
use leptos::prelude::*;
use lkjstr_core::Workspace;

use super::{Settings, Theme, Ui, keys, tiles};
use crate::host::{after, set_root_attr};
use crate::runtime::App;

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
        palette: RwSignal::new(false),
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
        super::navigation::restore(ui);
        booted.set(true);
    });
    persist_workspace(ui, booted);
    super::navigation::install(ui, booted);
    Effect::new(move |_| {
        let settings = ui.settings.get();
        let theme = match settings.theme {
            Theme::System => "system",
            Theme::Light => "light",
            Theme::Dark => "dark",
        };
        set_root_attr("data-theme", theme);
        set_root_attr(
            "data-density",
            if settings.compact {
                "compact"
            } else {
                "comfortable"
            },
        );
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
            <super::frame::TopBar/>
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
            <super::frame::PhoneBar/>
            <Toast/>
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

/// The last failed action, until dismissed.
#[component]
fn Toast() -> impl IntoView {
    let ui = Ui::get();
    let app = ui.app;
    let notice = Memo::new(move |_| {
        app.session_rev.track();
        app.with(|rt| rt.notice.clone())
    });
    let dismiss = move |_| {
        app.update(|rt| rt.notice = None);
        app.session_rev.update(|rev| *rev += 1);
    };
    move || {
        notice.get().map(|text| {
            view! {
                <div class="toast" role="alert">
                    <span>{text}</span>
                    <button class="ghost" on:click=dismiss>{move || ui.tr("Dismiss")}</button>
                </div>
            }
        })
    }
}
