//! Search: keys and note links open directly; text searches the local cache
//! instantly and asks NIP-50 relays in parallel.

use leptos::prelude::*;
use lkjstr_core::View;
use lkjstr_core::layout::TabId;
use lkjstr_core::plan::Want;
use lkjstr_protocol::{NostrEntity, decode_nip19};

use crate::ui::Ui;
use crate::ui::feed::hold_want;
use crate::ui::feed_state::prefetch;
use crate::ui::note::Note;
use crate::ui::note_parts::{Avatar, name_of};

#[component]
pub fn Search(tab: TabId, query: String, visible: Signal<bool>) -> impl IntoView {
    let ui = Ui::get();
    let app = ui.app;
    let draft = RwSignal::new(query.clone());
    let active = RwSignal::new(query);
    let submit = move || {
        let text = draft.get_untracked().trim().to_owned();
        if !lkjstr_core::addresses::safe_query(&text) {
            draft.set(String::new());
            app.update(|rt| {
                rt.notice =
                    Some(ui.tr("Secret keys cannot be searched. Open Accounts to import a key."))
            });
            app.session_rev.update(|r| *r += 1);
            return;
        }
        active.set(text.clone());
        ui.ws.update(|ws| {
            ws.navigate(tab, View::Search { query: text });
        });
    };
    let direct = Memo::new(move |_| {
        let text = active.get();
        let entity = decode_nip19(text.trim().trim_start_matches("nostr:"))?;
        Some(match entity {
            NostrEntity::Npub(pubkey) => ("Open profile", View::Profile { pubkey }),
            NostrEntity::Nprofile(p) => ("Open profile", View::Profile { pubkey: p.pubkey }),
            NostrEntity::Note(id) => ("Open note", View::Thread { id, relays: vec![] }),
            NostrEntity::Nevent(p) => (
                "Open note",
                View::Thread {
                    id: p.id,
                    relays: p.relays.unwrap_or_default(),
                },
            ),
            _ => return None,
        })
    });
    let secret = Memo::new(move |_| !lkjstr_core::addresses::safe_query(&active.get()));
    let live = hold_want(ui, visible, move || {
        let text = active.get();
        (!secret.get() && text.chars().count() >= 2 && direct.get().is_none()).then_some(
            Want::Search {
                query: text,
                limit: 50,
            },
        )
    });
    let progress = Memo::new(move |_| {
        app.net_rev.track();
        app.rev.track();
        live.get().map(|id| app.with(|rt| rt.progress(id)))
    });
    let people = Memo::new(move |_| {
        app.rev.track();
        app.with(|rt| rt.store.search_people(&active.get(), 8))
    });
    let notes = Memo::new(move |_| {
        app.rev.track();
        app.with(|rt| rt.store.search_notes(&active.get(), 60))
    });
    prefetch(ui, visible, Signal::derive(move || notes.get()));
    view! {
        <div class="search">
            <form class="search-bar" on:submit=move |ev| { ev.prevent_default(); submit(); }>
                <input type="search" placeholder=move || ui.tr("Words, #tags, npub or note links") aria-label=move || ui.tr("Search")
                    prop:value=move || draft.get() on:input=move |ev| draft.set(event_target_value(&ev))/>
                <button type="submit">{move || ui.tr("Search")}</button>
            </form>
            <div class="feed">
                {move || direct.get().map(|(label, view)| view! {
                    <div class="empty"><button on:click=move |_| { ui.detail(view.clone(), None); }>{move || ui.tr(label)}</button></div>
                })}
                <Show when=move || !people.with(Vec::is_empty)>
                    <h3 class="section">{move || ui.tr("People")}</h3>
                    <div class="people">
                        <For each=move || people.get() key=|pk| pk.clone() let:pubkey>
                            {
                                let key = pubkey.clone();
                                view! {
                                    <button class="person" on:click=move |_| ui.open_profile(&key)>
                                        <Avatar pubkey=pubkey.clone() class="avatar small"/>
                                        {move || name_of(ui, &pubkey)}
                                    </button>
                                }
                            }
                        </For>
                    </div>
                </Show>
                <For each=move || notes.get() key=|e| e.id.clone() let:event>
                    <Note event=event/>
                </For>
                {move || {
                    let text = active.get();
                    let empty = notes.with(Vec::is_empty) && people.with(Vec::is_empty) && direct.get().is_none();
                    let hint = if secret.get() {
                        "Secret keys cannot be searched. Open Accounts to import a key."
                    } else if text.is_empty() {
                        "Search notes cached on this device and on search relays."
                    } else if text.chars().count() < 2 {
                        "Enter at least two characters to ask search relays."
                    } else {
                        match progress.get() {
                            None => "Waiting to ask search relays…",
                            Some(p) if p.total == 0 => "No search relay to ask. Cached notes were searched.",
                            Some(p) if !p.settled() => "No matches yet. Search relays are still being asked.",
                            Some(p) if p.failed == p.total => "Search relays failed or refused this request. Cached notes were searched.",
                            Some(_) => "No matches on this device or the relays we asked.",
                        }
                    };
                    empty.then(|| view! { <div class="empty" role="status"><p>{ui.tr(hint)}</p>
                        <Show when=move || progress.get().is_some_and(|p| p.settled())>
                            <button on:click=move |_| { if let Some(id) = live.get_untracked() { app.retry(id); } }>{move || ui.tr("Try again")}</button>
                        </Show>
                    </div> })
                }}
            </div>
        </div>
    }
}
