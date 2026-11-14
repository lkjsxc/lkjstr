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

fn key(ui: Ui, tab: TabId) -> String {
    let route = ui
        .ws
        .with_untracked(|ws| ws.tabs.get(&tab).map(lkjstr_core::route::encode))
        .unwrap_or_default();
    format!("scroll:{tab}:{route}")
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

/// A pending save belongs to this view and is flushed when the view unmounts.
#[derive(Clone, Copy)]
pub struct Memory {
    ui: Ui,
    key: StoredValue<Option<String>>,
    latest: StoredValue<Option<String>>,
    dirty: StoredValue<bool>,
    timer: StoredValue<Option<TimeoutHandle>>,
    feed: NodeRef<Div>,
}

impl Memory {
    pub fn new(ui: Ui, tab: Option<TabId>, feed: NodeRef<Div>) -> Self {
        let memory = Self {
            ui,
            key: StoredValue::new(tab.map(|tab| key(ui, tab))),
            latest: StoredValue::new(None),
            dirty: StoredValue::new(false),
            timer: StoredValue::new(None),
            feed,
        };
        on_cleanup(move || {
            if let Some(timer) = memory.timer.get_value() {
                timer.clear();
            }
            memory.flush();
        });
        memory
    }

    fn flush(self) {
        if self.dirty.get_value()
            && let Some(key) = self.key.get_value()
        {
            self.ui
                .app
                .kv_put(&key, self.latest.get_value().as_deref().unwrap_or(""));
            self.dirty.set_value(false);
        }
    }

    pub fn remember(self) {
        if self.key.get_value().is_none() {
            return;
        }
        let Some(container) = self.feed.get_untracked() else {
            return;
        };
        self.latest.set_value(if container.scroll_top() < 40 {
            None
        } else {
            top_note(&container)
        });
        self.dirty.set_value(true);
        if self.timer.get_value().is_some() {
            return;
        }
        self.timer.set_value(
            set_timeout_with_handle(
                move || {
                    self.timer.set_value(None);
                    self.flush();
                },
                std::time::Duration::from_millis(SAVE_MS),
            )
            .ok(),
        );
    }
}

/// Restores the saved anchor once it is among the rendered rows.
pub fn restore(ui: Ui, tab: Option<TabId>, feed: NodeRef<Div>, rows: Signal<Vec<Event>>) {
    let Some(tab) = tab else { return };
    let anchor = RwSignal::new(None::<String>);
    let storage_key = key(ui, tab);
    leptos::task::spawn_local(async move {
        let saved = ui
            .app
            .kv_get(&storage_key)
            .await
            .filter(|id| !id.is_empty());
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
