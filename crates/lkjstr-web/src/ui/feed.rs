//! Timelines rendered from the local store first, reconciled with relays.
//! New notes wait behind a marker unless the reader is at the top; rows
//! skip rendering off screen (`content-visibility`), the list is capped.

pub use super::feed_source::Source;
use leptos::prelude::*;
use lkjstr_core::pagination::Page;
use lkjstr_core::plan::{Want, WantId};
use lkjstr_core::store::Event;
use lkjstr_core::timeline::Timeline;
use wasm_bindgen::JsCast;

use super::Ui;
use super::feed_memory;
use super::feed_state::{EmptyState, prefetch};
use super::note::Note;
use super::notify::Notification;
use super::text::date_label;

pub(super) const PAGE: usize = lkjstr_core::pagination::PAGE_SIZE;
const SHOWN_CAP: usize = 600;
/// Upper bound on raw rows scanned per feed, including hidden noise.
const QUERY_CAP: usize = 6_000;

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
pub fn Feed(
    source: Source,
    visible: Signal<bool>,
    #[prop(optional)] tab: Option<lkjstr_core::layout::TabId>,
) -> impl IntoView {
    let ui = Ui::get();
    let app = ui.app;
    let me = Memo::new(move |_| {
        app.session_rev.track();
        app.with(|rt| rt.session.active.clone())
    });
    let language_filter = RwSignal::new(source == Source::Global);
    let japanese = web_sys::window().is_some_and(|w| {
        w.navigator()
            .language()
            .is_some_and(|l| l.starts_with("ja"))
    });
    let src = StoredValue::new(source.clone());
    let authors = Memo::new(move |_| {
        app.rev.track();
        src.with_value(|s| s.authors(ui, &me.get()))
    });
    let limit = RwSignal::new(PAGE);
    let older = RwSignal::new(None::<(u64, usize)>);
    let live = hold_want(ui, visible, move || {
        src.with_value(|s| s.want(&authors.get(), &me.get(), None, PAGE))
    });
    let paged = hold_want(ui, visible, move || {
        let (until, limit) = older.get()?;
        src.with_value(|s| s.want(&authors.get(), &me.get(), Some(until), limit))
    });
    let timeline = StoredValue::new(Timeline::new(SHOWN_CAP));
    let scope = StoredValue::new((None::<Vec<String>>, None::<String>));
    let at_top = RwSignal::new(true);
    let tick = RwSignal::new(0u32);
    let rows = Memo::new(move |_| {
        app.rev.track();
        tick.track();
        let next_scope = (authors.get(), me.get());
        if scope.get_value() != next_scope {
            limit.set(PAGE);
            older.set(None);
            timeline.update_value(Timeline::clear);
            scope.set_value(next_scope);
        }
        let Some(query) = src.with_value(|s| s.query(&authors.get(), &me.get(), limit.get()))
        else {
            return (Vec::<Event>::new(), 0, Page::default());
        };
        let mut found = app.with(|rt| rt.store.feed(&query));
        let page = Page {
            count: found.len(),
            oldest: found.last().map(|e| e.created_at),
            at_oldest: found
                .iter()
                .rev()
                .take_while(|e| {
                    found
                        .last()
                        .is_some_and(|last| e.created_at == last.created_at)
                })
                .count(),
        };
        if src.with_value(|s| *s == Source::Global) {
            found.retain(|e| e.kind != 1 || !lkjstr_core::content::looks_like_noise(&e.content));
            if language_filter.get() {
                found.retain(|e| {
                    let original = if e.kind == 6 {
                        lkjstr_protocol::event_references(e)
                            .into_iter()
                            .next()
                            .and_then(|r| app.with(|rt| rt.store.get(&r.id)))
                    } else {
                        Some(e.clone())
                    };
                    original.is_none_or(|e| {
                        lkjstr_core::reading::language_matches(&e.content, japanese)
                    })
                });
            }
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
                (shown, t.pending_count(), page)
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
    let container = NodeRef::<leptos::html::Div>::new();
    let memory = feed_memory::Memory::new(ui, tab, container);
    feed_memory::restore(
        ui,
        tab,
        container,
        Signal::derive(move || rows.with(|r| r.0.clone())),
    );
    let load_more = move |near_end: bool| {
        let settled = [live.get(), paged.get()].into_iter().flatten().all(|id| {
            app.with(|rt| {
                let p = rt.progress(id);
                p.total > 0 && p.settled()
            })
        });
        let next = rows.with(|r| {
            r.2.next(
                limit.get(),
                older.get().map(|p| p.0),
                settled,
                near_end || r.0.len() < PAGE,
                QUERY_CAP,
            )
        });
        if let Some(until) = next {
            limit.update(|l| *l = (*l + PAGE).min(QUERY_CAP));
            older.set(Some(until));
        }
    };
    Effect::new(move |_| {
        app.net_rev.track();
        if visible.get() {
            load_more(false);
        }
    });
    let on_scroll = move |ev: web_sys::Event| {
        memory.remember();
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
        load_more(near_end);
    };
    let is_notifications = source == Source::Notifications;
    view! {
        <div class="feed" node_ref=container on:scroll=on_scroll>
            <Show when=move || src.with_value(|s| *s == Source::Global) && me.get().is_none() && !ui.settings.get().welcome_dismissed>
                <div class="welcome-banner"><span>{move || ui.tr("Read without an account. Your cache stays on this device.")}</span><button class="link" on:click=move |_| { ui.open(lkjstr_core::View::Accounts,lkjstr_core::Open::Here); }>{move || ui.tr("Add a key")}</button><button class="link" on:click=move |_| ui.settings.update(|s| s.welcome_dismissed=true)>{move || ui.tr("Browse")}</button><button class="link" on:click=move |_| { ui.open(lkjstr_core::View::Relays,lkjstr_core::Open::Here); }>{move || ui.tr("See relays")}</button></div>
            </Show>
            <Show when=move || language_filter.get()><div class="filter-row"><button title=move || ui.tr("Local script heuristic; show all languages") on:click=move |_| language_filter.set(false)>{move || ui.tr(if japanese { "Japanese notes · show all" } else { "English notes · show all" })}</button></div></Show>
            <Show when=move || rows.with(|r| r.1 > 0)>
                <button class="new-marker" aria-live="polite" on:click=move |ev| {
                    reveal();
                    if let Some(el) = ev.target().and_then(|t| t.dyn_into::<web_sys::Element>().ok()).and_then(|e| e.parent_element()) {
                        el.set_scroll_top(0);
                    }
                }>{move || ui.fmt("{0} new · show", &[&rows.with(|r| r.1).to_string()])}</button>
            </Show>
            <For each=move || rows.get().0 key=|event| event.id.clone() let:event>
                {let row_id = event.id.clone(); let at = event.created_at; view! { <Show when=move || rows.with(|r| r.0.iter().position(|e| e.id == row_id).is_some_and(|i| (i == 0 && at / 86_400 != crate::host::now_secs() / 86_400) || (i > 0 && r.0[i - 1].created_at / 86_400 != r.0[i].created_at / 86_400)))>
                    <div class="date-divider">{date_label(ui, at)}</div>
                </Show> }}
                {if is_notifications { view! { <Notification event=event/> }.into_any() } else { view! { <Note event=event/> }.into_any() }}
            </For>
            <EmptyState source=source.clone() live=live count=Signal::derive(move || rows.with(|r| r.0.len())) authors_known=Signal::derive(move || { app.rev.track(); me.get().is_some_and(|me| app.with(|rt| rt.store.follows(&me).is_some())) })/>
        </div>
    }
}
