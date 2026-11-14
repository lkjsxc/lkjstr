//! A conversation: the root, every reply we can find, indented by depth,
//! with the opened note highlighted and kept in view.

use std::collections::HashMap;

use leptos::prelude::*;
use lkjstr_core::plan::Want;
use lkjstr_core::store::Event;
use lkjstr_protocol::tags::{reply_parent, reply_root};

use crate::host::after;
use crate::ui::Ui;
use crate::ui::feed::hold_want;
use crate::ui::feed_state::prefetch;
use crate::ui::note::Note;

/// Indentation stops growing here; deeper replies line up.
const MAX_DEPTH: usize = 6;

/// Depth-first order from the root, children oldest first.
fn arrange(root: &str, events: &[Event]) -> Vec<(Event, usize)> {
    let mut children: HashMap<String, Vec<Event>> = HashMap::new();
    let mut root_event = None;
    for event in events {
        if event.id == root {
            root_event = Some(event.clone());
            continue;
        }
        let parent = reply_parent(event)
            .or_else(|| reply_root(event))
            .unwrap_or_else(|| root.to_owned());
        let known = parent == root || events.iter().any(|e| e.id == parent);
        let key = if known { parent } else { root.to_owned() };
        children.entry(key).or_default().push(event.clone());
    }
    let mut out = Vec::new();
    let mut stack: Vec<(Event, usize)> = Vec::new();
    if let Some(root_event) = root_event {
        stack.push((root_event, 0));
    } else {
        for child in children
            .get(root)
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .rev()
        {
            stack.push((child, 0));
        }
    }
    while let Some((event, depth)) = stack.pop() {
        if out.len() > 500 {
            break;
        }
        for child in children
            .get(&event.id)
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .rev()
        {
            stack.push((child, (depth + 1).min(MAX_DEPTH)));
        }
        out.push((event, depth));
    }
    out
}

#[component]
pub fn Thread(id: String, relays: Vec<String>, visible: Signal<bool>) -> impl IntoView {
    let ui = Ui::get();
    let app = ui.app;
    let focus = StoredValue::new(id.clone());
    let event = Memo::new(move |_| {
        app.rev.track();
        app.with(|rt| rt.store.get(&focus.get_value()))
    });
    let root = Memo::new(move |_| {
        event
            .get()
            .map(|e| reply_root(&e).unwrap_or_else(|| e.id.clone()))
            .unwrap_or_else(|| focus.get_value())
    });
    let hints = StoredValue::new(relays);
    hold_want(ui, visible, move || {
        let author = event.get().map(|e| e.pubkey.clone());
        Some(Want::Thread {
            root: root.get(),
            author,
            relays: hints.get_value(),
        })
    });
    hold_want(ui, visible, move || {
        let missing = event.get().is_none() || app.with(|rt| rt.store.get(&root.get()).is_none());
        missing.then(|| Want::Events {
            ids: vec![focus.get_value(), root.get()],
            relays: hints.get_value(),
        })
    });
    let rows = Memo::new(move |_| {
        app.rev.track();
        let root = root.get();
        let mut events = app.with(|rt| rt.store.thread(&root));
        if let Some(focused) = event.get()
            && !events.iter().any(|e| e.id == focused.id)
        {
            events.push(focused);
        }
        arrange(&root, &events)
    });
    prefetch(
        ui,
        visible,
        Signal::derive(move || rows.with(|r| r.iter().map(|(e, _)| e.clone()).collect())),
    );
    let scrolled = StoredValue::new(false);
    Effect::new(move |_| {
        if rows.with(|r| r.iter().any(|(e, _)| e.id == focus.get_value())) && !scrolled.get_value()
        {
            scrolled.set_value(true);
            after(50, || crate::host::scroll_into_view(".pane .note.focused"));
        }
    });
    let progress = Memo::new(move |_| {
        app.net_rev.track();
        app.rev.track();
        rows.with(|r| r.len())
    });
    view! {
        <div class="feed thread">
            <For each=move || rows.get() key=|(event, depth)| (event.id.clone(), *depth) let:row>
                {
                    let focused = row.0.id == focus.get_value();
                    view! { <Note event=row.0 focused=focused depth=row.1/> }
                }
            </For>
            <Show when=move || progress.get() == 0>
                <div class="empty" role="status"><p>"Looking for this note on relays…"</p></div>
            </Show>
        </div>
    }
}
