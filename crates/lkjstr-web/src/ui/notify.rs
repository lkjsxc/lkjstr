//! Notification rows: replies and mentions render as notes; reactions,
//! reposts and zaps as one compact line about the note they target.

use leptos::prelude::*;
use lkjstr_core::store::Event;
use lkjstr_protocol::tags::tag_values;
use lkjstr_protocol::zap_receipt_amount_msats;

use super::Ui;
use super::note::Note;
use super::note_parts::Avatar;
use super::text::ago;

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
            "+" | "" => "liked",
            "-" => "disliked",
            _ => "reacted",
        }
        .to_owned(),
        9735 => match zap_receipt_amount_msats(&event) {
            Some(msats) => ui.fmt("zapped {0} sats", &[&(msats / 1000).to_string()]),
            None => "zapped".to_owned(),
        },
        _ => "mentioned you".to_owned(),
    };
    let reaction = (event.kind == 7).then(|| {
        let mut r = lkjstr_protocol::parse_reaction(&event);
        if r.kind == lkjstr_protocol::ReactionKind::Like {
            r.display = "❤️".into();
        }
        r
    });
    let target_text = {
        let target = target.clone();
        Memo::new(move |_| {
            ui.app.rev.track();
            target
                .as_ref()
                .and_then(|id| ui.app.with(|rt| rt.store.get(id)))
                .map(|e| e.content.clone())
        })
    };
    let who = actor.clone();
    let who_data = actor.clone();
    let actor_key = StoredValue::new(actor.clone());
    let target_for_excerpt = target.clone();
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
            <button class="avatar-button" data-profile=actor.clone() aria-label=move || ui.tr("Open profile") title=move || ui.tr("Open profile (p)") on:click=profile><Avatar pubkey=actor.clone() class="avatar small"/></button>
            <div class="note-main">
                <header>
                    <button class="name" data-profile=who_data title=move || ui.tr("Open profile (p)") on:click=profile><super::names::Name pubkey=who/></button>
                    <span class="notification-verb">{move || ui.tr(&verb)}</span>{reaction.map(|r| r.emoji.map(|e| view! { <img class="emoji" src=e.url alt=r.display.clone()/> }.into_any()).unwrap_or_else(|| r.display.into_any()))}
                    <time>{move || ago(event.created_at, ui.now.get())}</time>
                </header>
                <button class="quote-line excerpt-button" data-thread=target_for_excerpt title=move || ui.tr("Open note") on:click=open>{move || target_text.get().unwrap_or_else(|| ui.tr("your note"))}</button>
            </div>
        </article>
    }
    .into_any()
}
