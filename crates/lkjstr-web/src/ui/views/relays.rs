//! Relays: what is connected, how each relay is doing, and why.

use leptos::prelude::*;

use crate::runtime::status::Link;
use crate::ui::Ui;

fn link_text(ui: Ui, link: &Option<Link>) -> (String, &'static str) {
    match link {
        Some(Link::Open) => ("connected".to_owned(), "ok"),
        Some(Link::Connecting) => ("connecting".to_owned(), "wait"),
        Some(Link::Failed(why)) => (ui.fmt("failed: {0}", &[why]), "bad"),
        Some(Link::BackingOff(ms)) => (
            ui.fmt("retrying in {0}s", &[&(ms / 1000 + 1).to_string()]),
            "bad",
        ),
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
            <h2>{move || ui.tr("Relays")}</h2>
            <dl class="relay-summary">{move || {
                let (s, _, events) = summary.get();
                [("Connected",s.open),("In use",s.live),("Requests waiting",s.waiting),("Notes cached",events)].into_iter().map(|(label,n)| view! { <div><dt>{move || ui.tr(label)}</dt><dd>{n}</dd></div> }).collect_view()
            }}</dl>
            <details><summary>{move || ui.tr("How relays are chosen")}</summary><p class="small muted">{move || ui.tr("lkjstr uses authors' relay lists, prefers useful answers, asks another relay when one is slow, and backs off after failures. Scores are measured on this device.")}</p></details>
            <div class="table-wrap"><table class="relays">
                <thead><tr><th>{move || ui.tr("Relay")}</th><th>{move || ui.tr("State")}</th><th>{move || ui.tr("Requests")}</th><th>{move || ui.tr("Latency")}</th><th>{move || ui.tr("Events")}</th><th>{move || ui.tr("Score")}</th></tr></thead>
                <tbody>
                    <For each=move || rows.get() key=|row| (row.url.clone(), format!("{:?}{}{}{:?}", row.link, row.requests, row.events, row.latency_ms.map(|l| l as u64))) let:row>
                        {
                            let (state, tone) = link_text(ui, &row.link);
                            view! {
                                <tr>
                                    <td class="url">{row.url.trim_start_matches("wss://").trim_end_matches('/').to_owned()}
                                        {row.auth_required.then(|| view! { <span class="pill">{move || ui.tr("needs sign-in")}</span> })}
                                        {row.notice.clone().map(|n| view! { <div class="small muted">{n}</div> })}
                                    </td>
                                    <td data-label=move || ui.tr("State")><span class=format!("dot {tone}")></span>{move || ui.tr(&state)}</td>
                                    <td data-label=move || ui.tr("Requests")>{row.requests}</td>
                                    <td data-label=move || ui.tr("Latency")>{row.latency_ms.map(|ms| format!("{} ms", ms as u64)).unwrap_or_else(|| "–".to_owned())}</td>
                                    <td data-label=move || ui.tr("Events")>{row.events}</td>
                                    <td data-label=move || ui.tr("Score")>{format!("{:.2}", row.score)}</td>
                                </tr>
                            }
                        }
                    </For>
                </tbody>
            </table></div>
            <h3>{move || ui.tr("Your relay list")}</h3>
            {move || match own.get() {
                Some(list) if !list.is_empty() => view! {
                    <ul class="plain">
                        {list.into_iter().map(|(url, read, write)| view! {
                            <li>{url} " · " {match (read, write) { (true, true) => ui.tr("read and write"), (true, false) => ui.tr("read"), _ => ui.tr("write") }}</li>
                        }).collect_view()}
                    </ul>
                }.into_any(),
                Some(_) | None => view! {
                    <p class="muted">{move || ui.tr("No published relay list (NIP-65) found for the active account, so lkjstr reads from its default relays.")}</p>
                }.into_any(),
            }}
        </div>
    }
}
