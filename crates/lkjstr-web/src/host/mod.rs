//! Thin browser adapters. Everything here is effectful glue; decisions live
//! in lkjstr-core.

pub mod idb;
pub mod nip07;
pub mod socket;

use std::time::Duration;

use wasm_bindgen::JsCast;

pub fn now_ms() -> u64 {
    js_sys::Date::now() as u64
}

pub fn now_secs() -> u64 {
    now_ms() / 1000
}

/// Uniform 0..1, for jitter only (keys use the protocol crate's CSPRNG).
pub fn random() -> f64 {
    js_sys::Math::random()
}

pub fn after(ms: u64, run: impl FnOnce() + 'static) {
    leptos::prelude::set_timeout(run, Duration::from_millis(ms));
}

pub fn document_hidden() -> bool {
    web_sys::window()
        .and_then(|window| window.document())
        .is_some_and(|document| document.hidden())
}

pub fn copy_text(text: &str) {
    if let Some(window) = web_sys::window() {
        let _ = window.navigator().clipboard().write_text(text);
    }
}

pub fn focus_selector(selector: &str) {
    let element = web_sys::window()
        .and_then(|window| window.document())
        .and_then(|document| document.query_selector(selector).ok().flatten())
        .and_then(|element| element.dyn_into::<web_sys::HtmlElement>().ok());
    if let Some(element) = element {
        let _ = element.focus();
    }
}

pub fn media_prefers_dark() -> bool {
    web_sys::window()
        .and_then(|window| {
            window
                .match_media("(prefers-color-scheme: dark)")
                .ok()
                .flatten()
        })
        .is_some_and(|query| query.matches())
}

pub fn set_root_attr(name: &str, value: &str) {
    if let Some(root) = web_sys::window()
        .and_then(|window| window.document())
        .and_then(|document| document.document_element())
    {
        let _ = root.set_attribute(name, value);
    }
}

pub fn scroll_into_view(selector: &str) {
    if let Some(element) = web_sys::window()
        .and_then(|window| window.document())
        .and_then(|document| document.query_selector(selector).ok().flatten())
    {
        element.scroll_into_view_with_bool(true);
    }
}
