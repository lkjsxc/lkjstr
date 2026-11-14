//! Return focus when an overlay removes the element that held it.
use leptos::{ev, prelude::*};
use wasm_bindgen::JsCast;

pub fn return_on_close() {
    let previous = web_sys::window()
        .and_then(|w| w.document())
        .and_then(|d| d.active_element())
        .and_then(|e| e.dyn_into::<web_sys::HtmlElement>().ok());
    on_cleanup(move || {
        let removed = web_sys::window()
            .and_then(|w| w.document())
            .is_some_and(|d| {
                d.active_element()
                    .is_none_or(|e| e.tag_name() == "BODY" || !e.is_connected())
            });
        if removed
            && let Some(previous) = &previous
            && previous.is_connected()
        {
            let _ = previous.focus();
        }
    });
}

pub fn close_on_escape(shown: RwSignal<bool>) {
    return_on_close();
    let listener = window_event_listener(ev::keydown, move |event| {
        if event.key() == "Escape" {
            shown.set(false);
        }
    });
    on_cleanup(move || listener.remove());
}
