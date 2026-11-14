//! Honest feed states and predictive fetching for what is on screen.

use leptos::prelude::*;
use lkjstr_core::plan::{Want, WantId};
use lkjstr_core::store::Event;
use lkjstr_core::{Open, View};
use lkjstr_protocol::tags::{reply_parent, tag_values};

use super::Ui;
use super::feed::{Source, hold_want};
use super::text::plural;

/// Rows near the top whose authors and referenced notes are prefetched.
const PREFETCH_ROWS: usize = 60;
/// Most ids or pubkeys in one prefetch want.
const PREFETCH_MAX: usize = 120;

/// Asks for missing profiles and referenced notes of rendered rows.
pub fn prefetch(ui: Ui, visible: Signal<bool>, rows: Signal<Vec<Event>>) {
    let missing = Memo::new(move |_| {
        ui.app.rev.track();
        let rows = rows.get();
        ui.app.with(|rt| {
            let mut people: Vec<String> = Vec::new();
            let mut notes: Vec<String> = Vec::new();
            for event in rows.iter().take(PREFETCH_ROWS) {
                let mut keys = vec![event.pubkey.clone()];
                keys.extend(tag_values(event, "p").into_iter().take(3));
                for key in keys {
                    if rt.store.profile(&key).is_none() && !people.contains(&key) {
                        people.push(key);
                    }
                }
                let mut refs: Vec<String> = reply_parent(event).into_iter().collect();
                refs.extend(tag_values(event, "q"));
                if event.kind == 6 || event.kind == 7 {
                    refs.extend(tag_values(event, "e").into_iter().take(1));
                }
                for id in refs {
                    if rt.store.get(&id).is_none() && !notes.contains(&id) {
                        notes.push(id);
                    }
                }
            }
            people.truncate(PREFETCH_MAX);
            notes.truncate(PREFETCH_MAX);
            (people, notes)
        })
    });
    hold_want(ui, visible, move || {
        let people = missing.with(|m| m.0.clone());
        (!people.is_empty()).then_some(Want::Profiles {
            pubkeys: people,
            contacts: false,
        })
    });
    hold_want(ui, visible, move || {
        let notes = missing.with(|m| m.1.clone());
        (!notes.is_empty()).then_some(Want::Events {
            ids: notes,
            relays: vec![],
        })
    });
}

#[component]
pub fn EmptyState(
    source: Source,
    live: Memo<Option<WantId>>,
    count: Signal<usize>,
    authors_known: Signal<bool>,
) -> impl IntoView {
    let ui = Ui::get();
    let app = ui.app;
    let progress = Memo::new(move |_| {
        app.net_rev.track();
        app.rev.track();
        live.get().map(|id| app.with(|rt| rt.progress(id)))
    });
    let signed_in = Memo::new(move |_| {
        app.session_rev.track();
        app.with(|rt| rt.session.active.is_some())
    });
    let needs_account = matches!(source, Source::Home | Source::Notifications);
    let is_home = source == Source::Home;
    let message = move || -> Option<(String, Option<(&'static str, View)>)> {
        let progress = progress.get();
        if count.get() > 0 {
            return progress.filter(|p| !p.settled()).map(|p| {
                (
                    format!(
                        "Syncing · {} of {} answered",
                        p.answered,
                        plural(p.total, "relay", "relays")
                    ),
                    None,
                )
            });
        }
        if needs_account && !signed_in.get() {
            let hint = if is_home {
                "Sign in to see notes from people you follow."
            } else {
                "Sign in to see replies, mentions and reactions."
            };
            return Some((hint.to_owned(), Some(("Open Accounts", View::Accounts))));
        }
        let Some(progress) = progress else {
            if is_home && !authors_known.get() {
                return Some(("Looking for your follow list…".to_owned(), None));
            }
            return Some(("Waiting for relays…".to_owned(), None));
        };
        if progress.total == 0 {
            return Some((
                "No relay to ask yet.".to_owned(),
                Some(("Open Relays", View::Relays)),
            ));
        }
        if !progress.settled() {
            return Some((
                format!(
                    "Loading · {} of {} answered",
                    progress.answered,
                    plural(progress.total, "relay", "relays")
                ),
                None,
            ));
        }
        if progress.failed == progress.total {
            return Some((
                "Could not reach any relay for this view.".to_owned(),
                Some(("Open Relays", View::Relays)),
            ));
        }
        let text = match source {
            Source::Home => {
                "Nothing from the people you follow yet. Follow people from their profiles, or browse Global."
            }
            Source::Notifications => "No replies, mentions or reactions yet.",
            Source::Profile(_) => "No notes from this account on the relays we asked.",
            Source::Global => "Relays returned no notes.",
        };
        Some((text.to_owned(), None))
    };
    view! {
        {move || message().map(|(text, action)| {
            let rows = count.get() > 0;
            view! {
                <div class=if rows { "feed-foot" } else { "empty" } role="status">
                    <p>{text}</p>
                    {action.map(|(label, view)| view! {
                        <button on:click=move |_| { ui.open(view.clone(), Open::Here); }>{label}</button>
                    })}
                </div>
            }
        })}
    }
}
