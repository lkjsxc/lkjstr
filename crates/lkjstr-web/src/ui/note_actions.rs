//! Quiet icon controls and reaction chips. Unsupported actions say so.
use super::{
    Ui,
    icons::Icon,
    note::{act, like, nevent, repost},
};
use crate::host::copy_text;
use leptos::prelude::*;
use lkjstr_core::store::Event;
use lkjstr_protocol::reaction_tags;

#[component]
pub fn Actions(event: Event, counts: Memo<((usize, usize, usize), bool)>) -> impl IntoView {
    let ui = Ui::get();
    let event = StoredValue::new(event);
    let menu = RwSignal::new(false);
    let repost_menu = RwSignal::new(false);
    let reply = move |_| {
        ui.open(
            lkjstr_core::View::Compose {
                reply_to: Some(event.with_value(|e| e.id.clone())),
            },
            lkjstr_core::Open::Beside,
        );
    };
    view! {
        <footer class="actions" on:click=|ev| ev.stop_propagation()>
            <button title="Reply (r)" aria-label=move || ui.tr("Reply") on:click=reply><Icon name="reply"/>{move || nonzero(counts.get().0.0)}</button>
            <button title="Repost" aria-label=move || ui.tr("Repost") aria-expanded=move || repost_menu.get().to_string() on:click=move |_| repost_menu.update(|m| *m = !*m)><Icon name="repost"/>{move || nonzero(counts.get().0.1)}</button>
            <button title="Like (l)" aria-label=move || ui.tr("Like") class:on=move || counts.get().1 on:click=move |_| like(ui, &event.get_value())><Icon name="react"/>{move || nonzero(counts.get().0.2)}</button>
            <button title="Zap" aria-label=move || ui.tr("Zap") on:click=move |_| {
                ui.app.update(|rt| rt.notice = Some(ui.tr("Zap sending is not available yet.")));
                ui.app.session_rev.update(|r| *r += 1);
            }><Icon name="zap"/></button>
            <button title="More" aria-label=move || ui.tr("More") aria-expanded=move || menu.get().to_string() on:click=move |_| menu.update(|m| *m = !*m)><Icon name="more"/></button>
            <Show when=move || repost_menu.get()>
                <div class="menu" role="menu">
                    <button role="menuitem" on:click=move |_| { repost_menu.set(false); repost(ui, &event.get_value()); }>{move || ui.tr("Repost")}</button>
                    <button role="menuitem" on:click=move |_| repost_menu.set(false)>{move || ui.tr("Close")}</button>
                </div>
            </Show>
            <Show when=move || menu.get()>
                <div class="menu" role="menu">
                    <button role="menuitem" on:click=move |_| { copy_text(&nevent(ui, &event.get_value())); menu.set(false); }>{move || ui.tr("Copy link")}</button>
                    <button role="menuitem" on:click=move |_| { copy_text(&event.with_value(|e| e.id.clone())); menu.set(false); }>{move || ui.tr("Copy id")}</button>
                    <button role="menuitem" on:click=move |_| { copy_text(&event.with_value(|e| e.content.clone())); menu.set(false); }>{move || ui.tr("Copy text")}</button>
                    <button role="menuitem" on:click=move |_| menu.set(false)>{move || ui.tr("Close")}</button>
                </div>
            </Show>
        </footer>
    }
}

fn nonzero(count: usize) -> String {
    if count == 0 {
        String::new()
    } else {
        format!("{count}+")
    }
}

#[component]
pub fn Reactions(event: Event) -> impl IntoView {
    let ui = Ui::get();
    let event = StoredValue::new(event);
    let groups = Memo::new(move |_| {
        ui.app.rev.track();
        ui.app.session_rev.track();
        ui.app.with(|rt| {
            lkjstr_core::reactions::chips(
                &rt.store.reactions(&event.with_value(|e| e.id.clone())),
                rt.session.active.as_deref(),
            )
        })
    });
    view! {
        <div class="reactions" on:click=|ev| ev.stop_propagation()>
            {move || groups.get().into_iter().map(|chip| {
                let own = chip.own.clone();
                let content = chip.content.clone();
                let url = chip.url.clone();
                let label = chip.label.clone();
                view! {
                    <button class:on=own.is_some() aria-label=format!("{} {}+", chip.label, chip.count) title=chip.label.clone() on:click=move |_| {
                        if let Some(id) = &own {
                            act(ui, 5, String::new(), vec![vec!["e".into(), id.clone()], vec!["k".into(), "7".into()]]);
                        } else {
                            let mut tags = reaction_tags(&event.get_value(), None);
                            if let Some(url) = &url { tags.push(vec!["emoji".into(), content.trim_matches(':').to_owned(), url.clone()]); }
                            act(ui, 7, content.clone(), tags);
                        }
                    }>
                        {chip.url.map(|url| view! { <img class="emoji" src=url alt=label.clone()/> }.into_any()).unwrap_or_else(|| label.into_any())}
                        " " {format!("{}+", chip.count)}
                    </button>
                }
            }).collect_view()}
        </div>
    }
}
