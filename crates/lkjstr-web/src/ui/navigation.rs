//! Browser address bar and Back integrate with the focused tab's own history.
use super::Ui;
use leptos::{ev, prelude::*};
use lkjstr_core::{Open, View, route};

fn hash(view: &View) -> String {
    format!(
        "#view={}",
        js_sys::encode_uri_component(&route::encode(view))
            .as_string()
            .unwrap_or_default()
    )
}

pub fn restore(ui: Ui) {
    let view = web_sys::window()
        .and_then(|w| w.location().hash().ok())
        .and_then(|s| {
            s.strip_prefix("#view=")
                .and_then(|s| js_sys::decode_uri_component(s).ok())
                .and_then(|s| s.as_string())
        })
        .and_then(|s| route::decode(&s));
    if let Some(view) = view {
        ui.ws.update(|ws| {
            if ws.focused_tab().and_then(|tab| ws.tabs.get(&tab)) != Some(&view) {
                ws.open(view, Open::Here);
            }
        });
    }
}

pub fn install(ui: Ui, booted: RwSignal<bool>) {
    // Reload keeps history.state; older entries use the same position scale.
    let position = StoredValue::new(
        web_sys::window()
            .and_then(|w| w.history().ok())
            .and_then(|h| h.state().ok())
            .and_then(|state| state.as_f64())
            .filter(|n| n.is_finite())
            .unwrap_or(0.0),
    );
    let from_browser = StoredValue::new(false);
    let started = StoredValue::new(false);
    let focused = Memo::new(move |_| {
        ui.ws.with(|ws| {
            ws.focused_tab()
                .and_then(|tab| ws.tabs.get(&tab).cloned())
                .map(|view| (ws.focused_tab(), view))
        })
    });
    Effect::new(move |_| {
        if !booted.get() {
            return;
        }
        let Some((_, view)) = focused.get() else {
            return;
        };
        let Some(window) = web_sys::window() else {
            return;
        };
        let Ok(history) = window.history() else {
            return;
        };
        let url = hash(&view);
        if !started.get_value() || from_browser.get_value() {
            let _ = history.replace_state_with_url(&position.get_value().into(), "", Some(&url));
            started.set_value(true);
            from_browser.set_value(false);
        } else {
            position.update_value(|n| *n += 1.0);
            let _ = history.push_state_with_url(&position.get_value().into(), "", Some(&url));
        }
    });
    let back = window_event_listener(ev::popstate, move |event| {
        let Some(next) = event.state().as_f64() else {
            position.update_value(|n| *n += 1.0);
            from_browser.set_value(true);
            restore(ui);
            return;
        };
        let direction = if next < position.get_value() { -1 } else { 1 };
        position.set_value(next);
        from_browser.set_value(true);
        let mut changed = false;
        ui.ws.update(|ws| changed = ws.travel(direction));
        if !changed {
            from_browser.set_value(false);
            if let Some((_, view)) = focused.get_untracked()
                && let Some(w) = web_sys::window()
                && let Ok(h) = w.history()
            {
                let _ = h.replace_state_with_url(&next.into(), "", Some(&hash(&view)));
            }
        }
    });
    let mouse = window_event_listener(ev::mousedown, move |event| {
        if event.button() == 3 || event.button() == 4 {
            event.prevent_default();
            ui.ws.update(|ws| {
                ws.travel(if event.button() == 3 { -1 } else { 1 });
            });
        }
    });
    on_cleanup(move || {
        back.remove();
        mouse.remove();
    });
}

/// Middle click opens a kept neighbour tab while preserving both pane actives.
pub fn middle(ui: Ui, ev: web_sys::MouseEvent) {
    use wasm_bindgen::JsCast;
    if ev.button() != 1 || ev.default_prevented() {
        return;
    }
    let Some(el) = ev
        .target()
        .and_then(|t| t.dyn_into::<web_sys::Element>().ok())
    else {
        return;
    };
    if el.closest(".strip").ok().flatten().is_some() {
        return;
    }
    let closest = |selector| el.closest(selector).ok().flatten();
    let view = if let Some(actor) = closest("[data-profile]") {
        actor
            .get_attribute("data-profile")
            .map(|pubkey| View::Profile { pubkey })
    } else if let Some(card) = closest("[data-thread]") {
        card.get_attribute("data-thread")
            .map(|id| View::Thread { id, relays: vec![] })
    } else if let Some(link) = closest("a[href]") {
        link.get_attribute("href")
            .filter(|url| url.starts_with("https://") || url.starts_with("http://"))
            .map(|url| {
                if link.class_list().contains("media") {
                    View::Image { url }
                } else {
                    View::Link { url }
                }
            })
    } else if closest("button,input,textarea").is_some() {
        None
    } else {
        closest(".note[data-id]")
            .and_then(|note| note.get_attribute("data-id"))
            .map(|id| View::Thread { id, relays: vec![] })
    };
    if let Some(view) = view {
        ev.prevent_default();
        ui.detail(view, Some(&ev));
    }
}
