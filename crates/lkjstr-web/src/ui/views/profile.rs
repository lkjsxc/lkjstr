//! A person: header with name, about, follow state and keys, then notes.

use leptos::prelude::*;
use lkjstr_core::plan::Want;
use lkjstr_protocol::KIND_FOLLOW_LIST;

use crate::host::copy_text;
use crate::ui::Ui;
use crate::ui::feed::{Feed, Source, hold_want};
use crate::ui::note_parts::{Avatar, name_of};
use crate::ui::text::{npub, plural, short_npub};

/// Follows or unfollows `target` by republishing the active account's
/// kind 3. Refuses when that list has not been loaded (it would be wiped).
fn toggle_follow(ui: Ui, target: String) {
    let plan = ui.app.with(|rt| {
        let me = rt.session.active.clone()?;
        let list = rt.store.replaceable(&me, KIND_FOLLOW_LIST)?;
        let mut tags = list.tags.clone();
        let present = tags
            .iter()
            .any(|t| t.first().is_some_and(|n| n == "p") && t.get(1) == Some(&target));
        if present {
            tags.retain(|t| !(t.first().is_some_and(|n| n == "p") && t.get(1) == Some(&target)));
        } else {
            tags.push(vec!["p".into(), target.clone()]);
        }
        Some((tags, list.content.clone()))
    });
    let Some((tags, content)) = plan else {
        ui.app.update(|rt| rt.notice = Some("Your follow list has not loaded yet, so following now could erase it. Try again in a moment.".into()));
        ui.app.session_rev.update(|rev| *rev += 1);
        return;
    };
    leptos::task::spawn_local(async move {
        if let Err(error) = ui.app.publish(KIND_FOLLOW_LIST, content, tags).await {
            ui.app.update(|rt| rt.notice = Some(error));
            ui.app.session_rev.update(|rev| *rev += 1);
        }
    });
}

#[component]
pub fn Profile(pubkey: String, visible: Signal<bool>) -> impl IntoView {
    let ui = Ui::get();
    let app = ui.app;
    let key = StoredValue::new(pubkey.clone());
    hold_want(ui, visible, move || {
        Some(Want::Profiles {
            pubkeys: vec![key.get_value()],
            contacts: true,
        })
    });
    let profile = Memo::new(move |_| {
        app.rev.track();
        app.with(|rt| rt.store.profile(&key.get_value()))
    });
    let following = Memo::new(move |_| {
        app.rev.track();
        app.with(|rt| rt.store.follows(&key.get_value()).map(|f| f.len()))
    });
    let relation = Memo::new(move |_| {
        app.rev.track();
        app.session_rev.track();
        app.with(|rt| {
            let me = rt.session.active.clone()?;
            if me == key.get_value() {
                return Some("you");
            }
            let follows = rt.store.follows(&me)?;
            Some(if follows.contains(&key.get_value()) {
                "following"
            } else {
                "not following"
            })
        })
    });
    let full = npub(&pubkey);
    let copy = full.clone();
    view! {
        <div class="profile-page">
            <header class="profile-head">
                {move || profile.get().filter(|p| !p.banner.is_empty()).map(|p| view! {
                    <img class="banner" src=p.banner.clone() alt="" loading="lazy" referrerpolicy="no-referrer"/>
                })}
                <div class="profile-id">
                    <Avatar pubkey=pubkey.clone() class="avatar large"/>
                    <div>
                        <h2>{move || name_of(ui, &key.get_value())}</h2>
                        <p class="muted">{move || {
                            let nip05 = profile.get().map(|p| p.nip05.clone()).unwrap_or_default();
                            let named = profile.get().is_some_and(|p| p.label().is_some());
                            if !nip05.is_empty() { nip05 } else if named { short_npub(&key.get_value()) } else { String::new() }
                        }}</p>
                    </div>
                    <span class="strip-fill"></span>
                    {move || match relation.get() {
                        Some("you") => view! { <span class="pill">"This is you"</span> }.into_any(),
                        Some(state) => {
                            let label = if state == "following" { "Unfollow" } else { "Follow" };
                            view! { <button class:primary=state != "following" on:click=move |_| toggle_follow(ui, key.get_value())>{label}</button> }.into_any()
                        }
                        None => ().into_any(),
                    }}
                </div>
                <p class="about">{move || profile.get().map(|p| p.about.clone()).unwrap_or_default()}</p>
                <p class="muted small">
                    {move || following.get().map(|n| format!("Follows {} · ", plural(n, "account", "accounts")))}
                    <button class="link" title=full.clone() on:click=move |_| copy_text(&copy)>"Copy npub"</button>
                    {move || profile.get().filter(|p| !p.website.is_empty()).map(|p| view! {
                        " · " <a href=p.website.clone() target="_blank" rel="noopener noreferrer nofollow">{p.website.clone()}</a>
                    })}
                </p>
            </header>
            <Feed source=Source::Profile(pubkey) visible=visible/>
        </div>
    }
}
