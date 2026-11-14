//! Scroll memory: each feed tab remembers the note at the top of its view
//! and returns to it after a reload, once that note renders again.

use leptos::html::Div;
use leptos::prelude::*;
use lkjstr_core::layout::TabId;
use lkjstr_core::store::Event;
use wasm_bindgen::JsCast;
use web_sys::HtmlElement;

use super::Ui;
use crate::host::after;

const SAVE_MS: u64 = 600;

fn key(tab: TabId) -> String {
    format!("scroll:{tab}")
}

/// Id of the first note whose bottom is below the container's top.
fn top_note(container: &HtmlElement) -> Option<String> {
    let top = container.get_bounding_client_rect().top();
    let notes = container.query_selector_all(".note[data-id]").ok()?;
    (0..notes.length())
        .filter_map(|i| notes.item(i)?.dyn_into::<HtmlElement>().ok())
        .find(|note| note.get_bounding_client_rect().bottom() > top + 8.0)
        .and_then(|note| note.get_attribute("data-id"))
}

/// Saves the anchor shortly after scrolling stops.
pub fn remember(ui: Ui, tab: Option<TabId>, feed: NodeRef<Div>, pending: StoredValue<bool>) {
    let Some(tab) = tab else { return };
    if pending.get_value() {
        return;
    }
    pending.set_value(true);
    after(SAVE_MS, move || {
        pending.set_value(false);
        let Some(container) = feed.get_untracked() else {
            return;
        };
        let anchor = if container.scroll_top() < 40 {
            None
        } else {
            top_note(&container)
        };
        ui.app.kv_put(&key(tab), anchor.as_deref().unwrap_or(""));
    });
}

/// Restores the saved anchor once it is among the rendered rows.
pub fn restore(ui: Ui, tab: Option<TabId>, feed: NodeRef<Div>, rows: Signal<Vec<Event>>) {
    let Some(tab) = tab else { return };
    let anchor = RwSignal::new(None::<String>);
    leptos::task::spawn_local(async move {
        let saved = ui.app.kv_get(&key(tab)).await.filter(|id| !id.is_empty());
        anchor.set(saved);
    });
    Effect::new(move |_| {
        let Some(id) = anchor.get() else { return };
        if !rows.with(|rows| rows.iter().any(|e| e.id == id)) {
            return;
        }
        anchor.set(None);
        after(0, move || {
            let selector = format!(".note[data-id=\"{id}\"]");
            let found = feed
                .get_untracked()
                .and_then(|c| c.query_selector(&selector).ok().flatten());
            if let Some(note) = found {
                note.scroll_into_view_with_bool(true);
            }
        });
    });
}
