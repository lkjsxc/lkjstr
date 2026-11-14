//! Honest feed states and predictive fetching for what is on screen.

use leptos::prelude::*;
use lkjstr_core::plan::{Want, WantId};
use lkjstr_core::store::Event;
use lkjstr_core::{Open, View};

use super::Ui;
use super::feed::{Source, hold_want};
use super::text::plural;

/// Asks for missing profiles and referenced notes of rendered rows.
pub fn prefetch(ui: Ui, visible: Signal<bool>, rows: Signal<Vec<Event>>) {
    let missing = Memo::new(move |_| {
        ui.app.rev.track();
        let rows = rows.get();
        ui.app
            .with(|rt| lkjstr_core::prefetch::collect(&rows, &rt.store))
    });
    hold_want(ui, visible, move || {
        let people = missing.with(|m| m.people.clone());
        (!people.is_empty()).then_some(Want::Profiles {
            pubkeys: people,
            contacts: false,
        })
    });
    hold_want(ui, visible, move || {
        let refs = missing.get();
        (!refs.notes.is_empty()).then_some(Want::Events {
            ids: refs.notes,
            relays: refs.relays,
        })
    });
    hold_want(ui, visible, move || {
        let refs = missing.get();
        (!refs.deletions.is_empty()).then_some(Want::Deletions {
            ids: refs.deletions,
            relays: refs.deletion_relays,
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
            Source::Home if !authors_known.get() => {
                "No follow list found for this account yet. Follow people from their profiles, or browse Global."
            }
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
