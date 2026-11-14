//! A note in a timeline or thread, with keyboard and pointer actions.

use leptos::prelude::*;
use lkjstr_core::store::Event;
use lkjstr_core::{Open, View};
use lkjstr_protocol::{
    EventPointer, encode_nevent, reaction_tags, repost_tags, tags::reply_parent, tags::reply_root,
};
use web_sys::KeyboardEvent;

use super::Ui;
use super::note_parts::{Avatar, Content, name_of};
use super::text::{ago, short_npub, stamp};
use crate::host::{copy_text, now_secs};

fn nevent(ui: Ui, event: &Event) -> String {
    let relays = ui.app.with(|rt| {
        rt.store
            .seen_on(&event.id)
            .iter()
            .take(2)
            .cloned()
            .collect()
    });
    let pointer = EventPointer {
        id: event.id.clone(),
        relays: Some(relays),
        author: Some(event.pubkey.clone()),
        kind: Some(event.kind),
    };
    encode_nevent(&pointer)
        .map(|code| format!("nostr:{code}"))
        .unwrap_or_default()
}

fn act(ui: Ui, kind: u64, content: String, tags: Vec<Vec<String>>) {
    leptos::task::spawn_local(async move {
        if let Err(error) = ui.app.publish(kind, content, tags).await {
            ui.app.update(|rt| rt.notice = Some(error));
            ui.app.session_rev.update(|rev| *rev += 1);
        }
    });
}

/// Toggles the active account's like: publish `+`, or delete the old one.
fn like(ui: Ui, event: &Event) {
    let me = ui.app.with(|rt| rt.session.active.clone());
    let mine = ui.app.with(|rt| {
        rt.store
            .referencing(&event.id)
            .into_iter()
            .find(|e| e.kind == 7 && Some(&e.pubkey) == me.as_ref())
    });
    match mine {
        Some(reaction) => act(
            ui,
            5,
            String::new(),
            vec![
                vec!["e".into(), reaction.id.clone()],
                vec!["k".into(), "7".into()],
            ],
        ),
        None => act(ui, 7, "+".into(), reaction_tags(event, None)),
    }
}

fn repost(ui: Ui, event: &Event) {
    let content = serde_json::to_string(&**event).unwrap_or_default();
    act(ui, 6, content, repost_tags(event));
}

#[component]
pub fn Note(
    event: Event,
    #[prop(default = false)] focused: bool,
    #[prop(optional)] depth: usize,
) -> impl IntoView {
    let ui = Ui::get();
    let reposter = (event.kind == 6).then(|| event.pubkey.clone());
    let target = lkjstr_protocol::tags::tag_values(&event, "e")
        .into_iter()
        .next();
    let target_id_for_missing = StoredValue::new(target.clone());
    let shown = Memo::new(move |_| {
        ui.app.rev.track();
        if event.kind == 6 {
            target
                .as_ref()
                .and_then(|id| ui.app.with(|rt| rt.store.get(id)))
        } else {
            Some(event.clone())
        }
    });
    view! { {move || match shown.get() {
        Some(shown) => view! { <NoteBody shown=shown reposter=reposter.clone() focused=focused depth=depth/> }.into_any(),
        None => view! { <div class="note-missing">"↻ " <super::reference::Missing id=target_id_for_missing.get_value()/></div> }.into_any(),
    }} }
}

#[component]
fn NoteBody(shown: Event, reposter: Option<String>, focused: bool, depth: usize) -> impl IntoView {
    let ui = Ui::get();
    let id = shown.id.clone();
    let author = shown.pubkey.clone();
    let parent = reply_parent(&shown).or_else(|| reply_root(&shown));
    let counts = {
        let id = id.clone();
        Memo::new(move |_| {
            ui.app.rev.track();
            ui.app.session_rev.track();
            ui.app.with(|rt| {
                let me = rt.session.active.clone();
                let liked = rt
                    .store
                    .referencing(&id)
                    .iter()
                    .any(|e| e.kind == 7 && Some(&e.pubkey) == me.as_ref());
                (rt.store.counts(&id), liked)
            })
        })
    };
    let now = now_secs();
    let this = StoredValue::new(shown.clone());
    let open = move || {
        let id = this.with_value(|e| e.id.clone());
        ui.open_thread(&id, ui.app.with(|rt| rt.store.seen_on(&id).to_vec()));
    };
    let profile = move || ui.open_profile(&this.with_value(|e| e.pubkey.clone()));
    let reply = move || {
        ui.open(
            View::Compose {
                reply_to: Some(this.with_value(|e| e.id.clone())),
            },
            Open::Beside,
        );
    };
    let keydown = move |ev: KeyboardEvent| {
        use lkjstr_core::actions::{NoteAction, note_action};
        let modified = ev.alt_key() || ev.ctrl_key() || ev.meta_key() || ev.shift_key();
        if ev.default_prevented() || ev.repeat() || super::keys::typing(&ev) {
            return;
        }
        match note_action(&ev.key(), modified) {
            Some(NoteAction::Open) => open(),
            Some(NoteAction::Profile) => profile(),
            Some(NoteAction::Reply) => reply(),
            Some(NoteAction::Like) => like(ui, &this.get_value()),
            None => return,
        }
        ev.prevent_default();
        ev.stop_propagation();
    };
    let name_key = author.clone();
    let handle_key = author.clone();
    let nip05 = ui
        .app
        .with(|rt| rt.store.profile(&author).map(|p| p.nip05.clone()))
        .unwrap_or_default();
    view! {
        <article class="note" class:focused=focused tabindex="0" data-id=id.clone() style=format!("--depth: {depth}") on:keydown=keydown on:click=move |_| open()>
            {reposter.map(|who| view! { <div class="reposted">"↻ " {move || name_of(ui, &who)} " reposted"</div> })}
            <button class="avatar-button" aria-label="Open profile" on:click=move |ev| { ev.stop_propagation(); profile(); }>
                <Avatar pubkey=author.clone()/>
            </button>
            <div class="note-main">
                <header>
                    <button class="name" on:click=move |ev| { ev.stop_propagation(); profile(); }>{move || name_of(ui, &name_key)}</button>
                    {move || {
                        let label = name_of(ui, &handle_key);
                        let handle = if nip05.is_empty() { short_npub(&handle_key) } else { nip05.clone() };
                        (label != handle).then(|| view! { <span class="handle">{handle}</span> })
                    }}
                    <time title=stamp(shown.created_at)>{ago(shown.created_at, now)}</time>
                </header>
                {parent.filter(|_| depth == 0 && !focused).map(|parent| view! { <ReplyContext id=parent/> })}
                <Content event=shown.clone()/>
                <footer class="actions" on:click=|ev| ev.stop_propagation()>
                    <button title="Reply (r)" on:click=move |_| reply()>"Reply " {move || nonzero(counts.get().0.0)}</button>
                    <button title="Repost" on:click=move |_| repost(ui, &this.get_value())>"Repost " {move || nonzero(counts.get().0.1)}</button>
                    <button title="Like (l)" class:on=move || counts.get().1 on:click=move |_| like(ui, &this.get_value())>
                        {move || if counts.get().1 { "Liked " } else { "Like " }} {move || nonzero(counts.get().0.2)}
                    </button>
                    <button title="Copy a nostr: link to this note" on:click=move |_| copy_text(&nevent(ui, &this.get_value()))>"Copy link"</button>
                </footer>
            </div>
        </article>
    }
    .into_any()
}

fn nonzero(count: usize) -> String {
    if count == 0 {
        String::new()
    } else {
        count.to_string()
    }
}

#[component]
fn ReplyContext(id: String) -> impl IntoView {
    let ui = Ui::get();
    let target = id.clone();
    let parent = Memo::new(move |_| {
        ui.app.rev.track();
        ui.app
            .with(|rt| rt.store.get(&id).map(|e| e.pubkey.clone()))
    });
    view! {
        <button class="reply-context" on:click=move |ev| { ev.stop_propagation(); ui.open_thread(&target, vec![]); }>
            {move || match parent.get() {
                Some(pubkey) => format!("Replying to {}", name_of(ui, &pubkey)),
                None => "Reply in a thread".to_owned(),
            }}
        </button>
    }
}
