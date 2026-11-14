//! Notification rows: replies and mentions render as notes; reactions,
//! reposts and zaps as one compact line about the note they target.

use leptos::prelude::*;
use lkjstr_core::store::Event;
use lkjstr_protocol::tags::tag_values;
use lkjstr_protocol::zap_receipt_amount_msats;

use super::Ui;
use super::note::Note;
use super::note_parts::{Avatar, name_of};
use super::text::ago;
use crate::host::now_secs;

fn snippet(text: &str) -> String {
    let flat: String = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if flat.chars().count() > 90 {
        format!("{}…", flat.chars().take(88).collect::<String>())
    } else {
        flat
    }
}

#[component]
pub fn Notification(event: Event) -> impl IntoView {
    let ui = Ui::get();
    if event.kind == 1 {
        return view! { <Note event=event/> }.into_any();
    }
    let target = tag_values(&event, "e").last().cloned();
    let actor = if event.kind == 9735 {
        lkjstr_protocol::tags::first_tag_value(&event, "P").unwrap_or_else(|| event.pubkey.clone())
    } else {
        event.pubkey.clone()
    };
    let verb = match event.kind {
        6 => "reposted".to_owned(),
        7 => match event.content.as_str() {
            "+" | "" => "liked".to_owned(),
            "-" => "disliked".to_owned(),
            other => format!("reacted {}", other.chars().take(12).collect::<String>()),
        },
        9735 => match zap_receipt_amount_msats(&event) {
            Some(msats) => format!("zapped {} sats", msats / 1000),
            None => "zapped".to_owned(),
        },
        _ => "mentioned you".to_owned(),
    };
    let target_text = {
        let target = target.clone();
        Memo::new(move |_| {
            ui.app.rev.track();
            target
                .as_ref()
                .and_then(|id| ui.app.with(|rt| rt.store.get(id)))
                .map(|e| snippet(&e.content))
        })
    };
    let who = actor.clone();
    let actor_key = StoredValue::new(actor.clone());
    let open = move |ev: web_sys::MouseEvent| {
        if let Some(id) = &target {
            ui.detail(
                lkjstr_core::View::Thread {
                    id: id.clone(),
                    relays: vec![],
                },
                Some(&ev),
            );
        }
    };
    let profile = move |ev: web_sys::MouseEvent| {
        ev.stop_propagation();
        ui.detail(
            lkjstr_core::View::Profile {
                pubkey: actor_key.get_value(),
            },
            Some(&ev),
        );
    };
    view! {
        <article class="note compact" tabindex="0">
            <button class="avatar-button" aria-label="Open profile" title="Open profile (p)" on:click=profile><Avatar pubkey=actor class="avatar small"/></button>
            <div class="note-main">
                <p>
                    <button class="name" title="Open profile (p)" on:click=profile>{move || name_of(ui, &who)}</button>
                    " " {verb} " "
                    <time>{ago(event.created_at, now_secs())}</time>
                </p>
                <button class="quote-line excerpt-button" title="Open note" on:click=open>{move || target_text.get().unwrap_or_else(|| "your note".to_owned())}</button>
            </div>
        </article>
    }
    .into_any()
}
