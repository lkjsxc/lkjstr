//! Reactive references and their terminal lookup states.
use super::Ui;
use super::note_parts::{Avatar, Content, name_of};
use leptos::prelude::*;

#[component]
pub fn Missing(id: Option<String>) -> impl IntoView {
    let ui = Ui::get();
    let id = StoredValue::new(id);
    move || {
        ui.app.rev.track();
        ui.app.net_rev.track();
        let lookup = id.with_value(|id| id.as_ref().map(|id| ui.app.with(|rt| rt.lookup(id))));
        view! {
            <span>{lookup.map(|s| s.message()).unwrap_or("This reference has no target event ID.")}</span>
            {lookup.filter(|s| *s != lkjstr_core::requests::Lookup::Loading).map(|_| view! {
                <button on:click=move |ev| { ev.stop_propagation(); if let Some(id) = id.get_value() { ui.app.retry_event(&id); } }>{move || ui.tr("Try again")}</button>
            })}
        }
    }
}

/// An embedded quoted note, or a link while it loads.
#[component]
pub fn Quote(id: String, relays: Vec<String>) -> impl IntoView {
    let ui = Ui::get();
    let key = id.clone();
    let key_for_missing = StoredValue::new(key.clone());
    let event = Memo::new(move |_| {
        ui.app.rev.track();
        ui.app.with(|rt| rt.store.get(&key))
    });
    view! {
        <div class="quote" on:click=move |ev| { ev.stop_propagation(); ui.detail(lkjstr_core::View::Thread { id: id.clone(), relays: relays.clone() }, Some(&ev)); }>
            {move || match event.get() {
                Some(event) => view! {
                    <div class="quote-head"><Avatar pubkey=event.pubkey.clone() class="avatar small"/>{name_of(ui, &event.pubkey)}</div>
                    <Content event=event compact=true/>
                }.into_any(),
                None => view! { <span class="muted"><Missing id=Some(key_for_missing.get_value())/></span> }.into_any(),
            }}
        </div>
    }
}
