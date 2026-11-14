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
        now: RwSignal::new(crate::host::now_secs()),
        online: RwSignal::new(web_sys::window().is_none_or(|w| w.navigator().on_line())),
        ws: RwSignal::new(Workspace::preset(false)),
        spaces: RwSignal::new(Default::default()),
        settings: RwSignal::new(Settings::default()),
        narrow: RwSignal::new(window_width() < NARROW_PX),
        help: RwSignal::new(false),
        zoom: RwSignal::new(None),
        closed: RwSignal::new(None),
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
        if let Some(spaces) = boot
            .spaces
            .and_then(|s| lkjstr_core::spaces::Spaces::parse(&s, signed_in))
        {
            ui.ws.set(spaces.desks[spaces.active].clone());
            ui.spaces.set(spaces);
        }
        super::navigation::restore(ui);
        booted.set(true);
    });
    persist_workspace(ui, booted);
    super::spaces::install_sync(ui);
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
        set_root_attr(
            "style",
            &format!(
                "--text: {}px; --interface-scale: {}; --tab-width: {}",
                settings.text,
                settings.scale.clamp(80, 140) as f64 / 100.0,
                if settings.tab_width == 0 {
                    "auto".to_owned()
                } else {
                    format!("{}px", settings.tab_width.clamp(96, 240))
                }
            ),
        );
        if booted.get_untracked()
            && let Ok(text) = serde_json::to_string(&settings)
        {
            app.kv_put("settings", &text);
        }
    });
    let resize = window_event_listener(ev::resize, move |_| {
        ui.narrow.set(window_width() < NARROW_PX)
    });
    let clock = set_interval_with_handle(
        move || ui.now.set(crate::host::now_secs()),
        std::time::Duration::from_secs(30),
    )
    .ok();
    on_cleanup(move || {
        if let Some(clock) = clock {
            clock.clear();
        }
    });
    let online = window_event_listener(ev::online, move |_| ui.online.set(true));
    let offline = window_event_listener(ev::offline, move |_| ui.online.set(false));
    let middle = window_event_listener(ev::auxclick, move |event| {
        super::navigation::middle(ui, event)
    });
    let keydown = window_event_listener(ev::keydown, move |event| keys::handle(ui, &event));
    let flush = window_event_listener(ev::pagehide, move |_| {
        let mut spaces = ui.spaces.get_untracked();
        spaces.desks[spaces.active] = ui.ws.get_untracked();
        if let Ok(text) = serde_json::to_string(&spaces) {
            ui.app.kv_put("spaces", &text);
        }
        if let Ok(text) = serde_json::to_string(&ui.ws.get_untracked()) {
            ui.app.kv_put("workspace", &text);
        }
    });
    let shown = window_event_listener(ev::visibilitychange, move |_| {
        ui.page_visible.set(!crate::host::document_hidden());
    });
    on_cleanup(move || {
        resize.remove();
        middle.remove();
        online.remove();
        offline.remove();
        keydown.remove();
        shown.remove();
        flush.remove();
    });
    view! {
        <div class="app" class:narrow=move || ui.narrow.get()>
            <super::frame::TopBar/>
            <main class="desk" class:zooming=move || ui.zoom.get().is_some() aria-label="Workspace">
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
            <super::tab_effects::ClosedTab/>
        </div>
    }
}

/// Saves the layout shortly after each change.
fn persist_workspace(ui: Ui, booted: RwSignal<bool>) {
    let pending = StoredValue::new(false);
    Effect::new(move |_| {
        ui.ws.track();
        ui.spaces.track();
        if !booted.get() || pending.get_value() {
            return;
        }
        pending.set_value(true);
        after(400, move || {
            pending.set_value(false);
            if let Ok(text) = ui.ws.with_untracked(serde_json::to_string) {
                ui.app.kv_put("workspace", &text);
                let mut spaces = ui.spaces.get_untracked();
                spaces.desks[spaces.active] = ui.ws.get_untracked();
                if let Ok(text) = serde_json::to_string(&spaces) {
                    ui.app.kv_put("spaces", &text);
                    for (index, ws) in spaces.desks.iter().enumerate() {
                        if let Ok(text) = serde_json::to_string(ws) {
                            ui.app.kv_put(&format!("workspace:{index}"), &text);
                        }
                    }
                    super::spaces::broadcast(ui);
                }
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
