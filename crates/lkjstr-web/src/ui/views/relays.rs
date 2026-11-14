//! Relays: what is connected, how each relay is doing, and why.

use leptos::prelude::*;

use crate::runtime::status::Link;
use crate::ui::Ui;
use crate::ui::text::plural;

fn link_text(link: &Option<Link>) -> (String, &'static str) {
    match link {
        Some(Link::Open) => ("connected".to_owned(), "ok"),
        Some(Link::Connecting) => ("connecting".to_owned(), "wait"),
        Some(Link::Failed(why)) => (format!("failed: {why}"), "bad"),
        Some(Link::BackingOff(ms)) => (format!("retrying in {}s", ms / 1000 + 1), "bad"),
        None => ("not in use".to_owned(), "idle"),
    }
}

#[component]
pub fn Relays() -> impl IntoView {
    let ui = Ui::get();
    let app = ui.app;
    let rows = Memo::new(move |_| {
        app.net_rev.track();
        app.with(|rt| rt.relay_rows())
    });
    let summary = Memo::new(move |_| {
        app.net_rev.track();
        app.rev.track();
        app.with(|rt| (rt.summary(), rt.wants().len(), rt.store.len()))
    });
    let own = Memo::new(move |_| {
        app.rev.track();
        app.session_rev.track();
        app.with(|rt| {
            let me = rt.session.active.clone()?;
            rt.store.relay_list(&me)
        })
    });
    view! {
        <div class="page">
            <h2>"Relays"</h2>
            <p class="muted">{move || {
                let (s, wants, events) = summary.get();
                format!(
                    "{} open, {} connecting, {} failing · {} live, {} loading · {} views asking · {} events in memory",
                    s.open, s.connecting, s.failing, plural(s.live, "subscription", "subscriptions"), s.waiting, wants, events
                )
            }}</p>
            <p class="small muted">"lkjstr picks relays per author from their published relay lists (outbox), prefers relays that answer fast and return new notes, asks a second relay when one is slow, and backs off from failing relays."</p>
            <table class="relays">
                <thead><tr><th>"Relay"</th><th>"State"</th><th>"Requests"</th><th>"Latency"</th><th>"Events"</th><th>"Score"</th></tr></thead>
                <tbody>
                    <For each=move || rows.get() key=|row| (row.url.clone(), format!("{:?}{}{}{:?}", row.link, row.requests, row.events, row.latency_ms.map(|l| l as u64))) let:row>
                        {
                            let (state, tone) = link_text(&row.link);
                            view! {
                                <tr>
                                    <td class="url">{row.url.trim_start_matches("wss://").trim_end_matches('/').to_owned()}
                                        {row.auth_required.then(|| view! { <span class="pill">"needs sign-in"</span> })}
                                        {row.notice.clone().map(|n| view! { <div class="small muted">{n}</div> })}
                                    </td>
                                    <td><span class=format!("dot {tone}")></span>{state}</td>
                                    <td>{row.requests}</td>
                                    <td>{row.latency_ms.map(|ms| format!("{} ms", ms as u64)).unwrap_or_else(|| "–".to_owned())}</td>
                                    <td>{row.events}</td>
                                    <td>{format!("{:.2}", row.score)}</td>
                                </tr>
                            }
                        }
                    </For>
                </tbody>
            </table>
            <h3>"Your relay list"</h3>
            {move || match own.get() {
                Some(list) if !list.is_empty() => view! {
                    <ul class="plain">
                        {list.into_iter().map(|(url, read, write)| view! {
                            <li>{url} " · " {match (read, write) { (true, true) => "read and write", (true, false) => "read", _ => "write" }}</li>
                        }).collect_view()}
                    </ul>
                }.into_any(),
                Some(_) | None => view! {
                    <p class="muted">"No published relay list (NIP-65) found for the active account, so lkjstr reads from its default relays."</p>
                }.into_any(),
            }}
        </div>
    }
}
