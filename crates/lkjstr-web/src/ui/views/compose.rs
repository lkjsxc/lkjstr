//! Compose and reply. Drafts persist per tab; posting shows the note at once
//! and then each relay's answer.

use leptos::prelude::*;
use lkjstr_core::layout::TabId;
use lkjstr_core::plan::Want;
use lkjstr_protocol::{content_derived_tags, content_warning_tag};

use crate::runtime::{PubState, Publish};
use crate::ui::Ui;
use crate::ui::feed::hold_want;
use crate::ui::note::Note;
use crate::ui::text::plural;

fn hashtags(content: &str) -> Vec<Vec<String>> {
    content
        .split_whitespace()
        .filter_map(|word| word.strip_prefix('#'))
        .map(|tag| tag.trim_end_matches(|c: char| !c.is_alphanumeric() && c != '_'))
        .filter(|tag| !tag.is_empty())
        .map(|tag| vec!["t".to_owned(), tag.to_lowercase()])
        .collect()
}

fn publish_line(publish: &Publish) -> String {
    let total = publish.relays.len();
    let accepted = publish.accepted();
    let pending = publish.pending();
    if total == 0 {
        return "Saved locally; no relay to send to.".to_owned();
    }
    match (accepted, pending) {
        (0, 0) => "No relay accepted it. Check Relays and try again.".to_owned(),
        (a, 0) => format!(
            "Sent · accepted by {a} of {}",
            plural(total, "relay", "relays")
        ),
        (a, p) => format!("Sending · {a} accepted, {p} waiting"),
    }
}

#[component]
pub fn Compose(tab: TabId, reply_to: Option<String>, visible: Signal<bool>) -> impl IntoView {
    let ui = Ui::get();
    let app = ui.app;
    let key = format!(
        "draft:{}",
        reply_to.clone().unwrap_or_else(|| format!("tab{tab}"))
    );
    let text = RwSignal::new(String::new());
    let warning = RwSignal::new(None::<String>);
    let error = RwSignal::new(None::<String>);
    let busy = RwSignal::new(false);
    let draft_key = key.clone();
    leptos::task::spawn_local(async move {
        if let Some(saved) = app.kv_get(&draft_key).await
            && text.get_untracked().is_empty()
        {
            text.set(saved);
        }
    });
    let parent_id = StoredValue::new(reply_to.clone());
    hold_want(ui, visible, move || {
        app.rev.track();
        let id = parent_id.get_value()?;
        app.with(|rt| rt.store.get(&id))
            .is_none()
            .then(|| Want::Events {
                ids: vec![id],
                relays: vec![],
            })
    });
    let parent = Memo::new(move |_| {
        app.rev.track();
        parent_id
            .get_value()
            .and_then(|id| app.with(|rt| rt.store.get(&id)))
    });
    let can_sign = Memo::new(move |_| {
        app.session_rev.track();
        app.with(|rt| rt.session.can_sign())
    });
    let mine = Memo::new(move |_| {
        app.session_rev.track();
        app.with(|rt| rt.publishes.iter().take(5).cloned().collect::<Vec<_>>())
    });
    let save_key = StoredValue::new(key.clone());
    let post = move || {
        let content = text.get_untracked();
        if content.trim().is_empty() || busy.get_untracked() {
            return;
        }
        let parent = parent.get_untracked();
        let reply_to = parent_id.get_value();
        let mut tags =
            match lkjstr_core::actions::compose_tags(reply_to.as_deref(), parent.as_deref()) {
                Ok(tags) => tags,
                Err(message) => {
                    error.set(Some(message.into()));
                    return;
                }
            };
        tags.extend(hashtags(&content));
        if let Some(reason) = warning.get_untracked() {
            tags.push(content_warning_tag(&reason));
        }
        let tags = content_derived_tags(&content, &[], &tags);
        busy.set(true);
        let save_key = save_key.get_value();
        leptos::task::spawn_local(async move {
            match app.publish(1, content, tags).await {
                Ok(_) => {
                    text.set(String::new());
                    error.set(None);
                    app.kv_put(&save_key, "");
                }
                Err(message) => error.set(Some(message)),
            }
            busy.set(false);
        });
    };
    let input_key = key.clone();
    view! {
        <div class="page compose">
            {move || parent.get().map(|event| view! { <div class="reply-to"><Note event=event depth=1/></div> })}
            {move || (reply_to.is_some() && parent.get().is_none()).then(|| view! { <p class="muted"><crate::ui::reference::Missing id=parent_id.get_value()/></p> })}
            <textarea
                rows="6"
                placeholder=if parent_id.get_value().is_some() { "Write your reply" } else { "What's happening?" }
                aria-label="Note text"
                prop:value=move || text.get()
                on:input=move |ev| {
                    let value = event_target_value(&ev);
                    app.kv_put(&input_key, &value);
                    text.set(value);
                }
                on:keydown=move |ev: web_sys::KeyboardEvent| {
                    if ev.key() == "Enter" && (ev.ctrl_key() || ev.meta_key()) {
                        ev.prevent_default();
                        post();
                    }
                }
            ></textarea>
            <div class="compose-bar">
                <label class="check">
                    <input type="checkbox" prop:checked=move || warning.get().is_some()
                        on:change=move |ev| warning.set(event_target_checked(&ev).then(String::new))/>
                    "Content warning"
                </label>
                <span class="muted">{move || format!("{} characters", text.get().chars().count())}</span>
                <span class="strip-fill"></span>
                <button class="primary" disabled=move || !can_sign.get() || busy.get() || text.get().trim().is_empty() || (parent_id.get_value().is_some() && parent.get().is_none())
                    title="Post (Ctrl+Enter)" on:click=move |_| post()>
                    {move || if busy.get() { "Signing…" } else if parent_id.get_value().is_some() { "Reply" } else { "Post" }}
                </button>
            </div>
            <Show when=move || warning.get().is_some()>
                <input class="wide" placeholder="Reason (optional)" prop:value=move || warning.get().unwrap_or_default()
                    on:input=move |ev| warning.set(Some(event_target_value(&ev)))/>
            </Show>
            {move || (!can_sign.get()).then(|| view! { <p class="muted">"To post, add a key or connect a signer extension in Accounts."</p> })}
            {move || error.get().map(|e| view! { <p class="error" role="alert">{e}</p> })}
            <ul class="publishes">
                <For each=move || mine.get() key=|p| (p.event.id.clone(), p.accepted(), p.pending()) let:publish>
                    <li>
                        <span>{match publish.event.kind {
                            1 => publish.event.content.chars().take(60).collect::<String>(),
                            3 => "Follow list".to_owned(),
                            5 => "Undo (deletion request)".to_owned(),
                            6 => "Repost".to_owned(),
                            7 => "Like".to_owned(),
                            other => format!("Event of kind {other}"),
                        }}</span>
                        <span class="muted">{publish_line(&publish)}</span>
                        <details><summary>"Relays"</summary>
                            {publish.relays.iter().map(|(url, state)| view! {
                                <div class="small">{url.clone()} " · " {match state {
                                    PubState::Sending => "waiting".to_owned(),
                                    PubState::Accepted => "accepted".to_owned(),
                                    PubState::Rejected(why) => format!("refused: {why}"),
                                }}</div>
                            }).collect_view()}
                        </details>
                    </li>
                </For>
            </ul>
        </div>
    }
}
