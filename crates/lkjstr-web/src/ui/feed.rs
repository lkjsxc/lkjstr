//! Timelines rendered from the local store first, reconciled with relays.
//! New notes wait behind a marker unless the reader is at the top; rows
//! skip rendering off screen (`content-visibility`), the list is capped.

use std::collections::HashSet;

use leptos::prelude::*;
use lkjstr_core::plan::{MENTION_KINDS, NOTE_KINDS, Want, WantId};
use lkjstr_core::store::{Event, Query};
use lkjstr_core::timeline::Timeline;
use wasm_bindgen::JsCast;

use super::Ui;
use super::feed_state::{EmptyState, prefetch};
use super::note::Note;
use super::notify::Notification;

const PAGE: usize = 40;
const SHOWN_CAP: usize = 600;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Source {
    Home,
    Global,
    Notifications,
    Profile(String),
}

impl Source {
    fn authors(&self, ui: Ui, me: &Option<String>) -> Option<Vec<String>> {
        match self {
            Source::Home => {
                let me = me.clone()?;
                let mut follows = ui.app.with(|rt| rt.store.follows(&me))?;
                follows.push(me);
                Some(follows)
            }
            Source::Profile(pubkey) => Some(vec![pubkey.clone()]),
            _ => None,
        }
    }

    pub(super) fn want(
        &self,
        authors: &Option<Vec<String>>,
        me: &Option<String>,
        until: Option<u64>,
    ) -> Option<Want> {
        let limit = PAGE as u64;
        Some(match self {
            Source::Home | Source::Profile(_) => Want::Notes {
                authors: authors.clone()?,
                until,
                limit,
            },
            Source::Global => Want::Global { until, limit },
            Source::Notifications => Want::Mentions {
                pubkey: me.clone()?,
                until,
                limit: limit * 2,
            },
        })
    }

    fn query(
        &self,
        authors: &Option<Vec<String>>,
        me: &Option<String>,
        limit: usize,
    ) -> Option<Query> {
        let base = Query {
            limit,
            kinds: NOTE_KINDS.to_vec(),
            ..Query::default()
        };
        Some(match self {
            Source::Home | Source::Profile(_) => Query {
                authors: Some(authors.clone()?.into_iter().collect::<HashSet<_>>()),
                ..base
            },
            Source::Global => base,
            Source::Notifications => Query {
                mention: Some(me.clone()?),
                exclude_author: me.clone(),
                kinds: MENTION_KINDS.to_vec(),
                ..base
            },
        })
    }
}

/// Keeps one want registered while `visible`, updating it as inputs change.
pub fn hold_want(
    ui: Ui,
    visible: Signal<bool>,
    want: impl Fn() -> Option<Want> + 'static,
) -> Memo<Option<WantId>> {
    let slot = StoredValue::new(None::<WantId>);
    let current = RwSignal::new(None::<WantId>);
    Effect::new(move |_| {
        let next = if visible.get() { want() } else { None };
        match (slot.get_value(), next) {
            (Some(id), Some(want)) => ui.app.set_want(id, want),
            (None, Some(want)) => slot.set_value(Some(ui.app.want(want))),
            (Some(id), None) => {
                ui.app.drop_want(id);
                slot.set_value(None);
            }
            (None, None) => {}
        }
        current.set(slot.get_value());
    });
    on_cleanup(move || {
        if let Some(id) = slot.get_value() {
            ui.app.drop_want(id);
        }
    });
    Memo::new(move |_| current.get())
}

#[component]
pub fn Feed(source: Source, visible: Signal<bool>) -> impl IntoView {
    let ui = Ui::get();
    let app = ui.app;
    let me = Memo::new(move |_| {
        app.session_rev.track();
        app.with(|rt| rt.session.active.clone())
    });
    let src = StoredValue::new(source.clone());
    let authors = Memo::new(move |_| {
        app.rev.track();
        src.with_value(|s| s.authors(ui, &me.get()))
    });
    let limit = RwSignal::new(PAGE);
    let older = RwSignal::new(None::<u64>);
    let live = hold_want(ui, visible, move || {
        src.with_value(|s| s.want(&authors.get(), &me.get(), None))
    });
    let _paged = hold_want(ui, visible, move || {
        let until = older.get()?;
        src.with_value(|s| s.want(&authors.get(), &me.get(), Some(until)))
    });
    let timeline = StoredValue::new(Timeline::new(SHOWN_CAP));
    let at_top = RwSignal::new(true);
    let tick = RwSignal::new(0u32);
    let rows = Memo::new(move |_| {
        app.rev.track();
        tick.track();
        let Some(query) = src.with_value(|s| s.query(&authors.get(), &me.get(), limit.get()))
        else {
            return (Vec::<Event>::new(), 0);
        };
        let mut found = app.with(|rt| rt.store.feed(&query));
        if src.with_value(|s| *s == Source::Global) {
            found.retain(|e| !lkjstr_core::content::looks_like_noise(&e.content));
        }
        let items: Vec<_> = found.iter().map(|e| (e.created_at, e.id.clone())).collect();
        app.with(|rt| {
            timeline.update_value(|t| {
                t.retain(|id| rt.store.get(id).is_some());
                t.merge(&items, at_top.get_untracked());
            });
        });
        app.with(|rt| {
            timeline.with_value(|t| {
                let shown = t
                    .shown()
                    .iter()
                    .filter_map(|(_, id)| rt.store.get(id))
                    .collect();
                (shown, t.pending_count())
            })
        })
    });
    prefetch(
        ui,
        visible,
        Signal::derive(move || rows.with(|r| r.0.clone())),
    );
    let reveal = move || {
        timeline.update_value(Timeline::reveal);
        tick.update(|t| *t += 1);
    };
    let on_scroll = move |ev: web_sys::Event| {
        let Some(el) = ev
            .target()
            .and_then(|t| t.dyn_into::<web_sys::Element>().ok())
        else {
            return;
        };
        let top = el.scroll_top() < 40;
        if top != at_top.get_untracked() {
            at_top.set(top);
        }
        if top && rows.with_untracked(|r| r.1 > 0) {
            reveal();
        }
        let near_end = el.scroll_height() - el.scroll_top() - el.client_height() < 900;
        if near_end && rows.with_untracked(|r| r.0.len() + 5 >= limit.get_untracked()) {
            limit.update(|l| *l += PAGE);
            older.set(timeline.with_value(|t| t.oldest()));
        }
    };
    let is_notifications = source == Source::Notifications;
    view! {
        <div class="feed" on:scroll=on_scroll>
            <Show when=move || rows.with(|r| r.1 > 0)>
                <button class="new-marker" on:click=move |ev| {
                    reveal();
                    if let Some(el) = ev.target().and_then(|t| t.dyn_into::<web_sys::Element>().ok()).and_then(|e| e.parent_element()) {
                        el.set_scroll_top(0);
                    }
                }>{move || format!("{} new · show", rows.with(|r| r.1))}</button>
            </Show>
            <For each=move || rows.get().0 key=|event| event.id.clone() let:event>
                {if is_notifications { view! { <Notification event=event/> }.into_any() } else { view! { <Note event=event/> }.into_any() }}
            </For>
            <EmptyState source=source.clone() live=live count=Signal::derive(move || rows.with(|r| r.0.len())) authors_known=Signal::derive(move || authors.with(Option::is_some))/>
        </div>
    }
}
