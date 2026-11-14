//! Pieces of a note: avatar, author line and rendered content segments.

use leptos::prelude::*;
use lkjstr_core::content::{Segment, segments};
use lkjstr_core::store::Event;
use lkjstr_core::{Open, View};
use lkjstr_protocol::{content_warning_reason, has_content_warning};

use super::Ui;
use super::text::short_npub;

pub fn name_of(ui: Ui, pubkey: &str) -> String {
    ui.app.rev.track();
    ui.app
        .with(|rt| {
            rt.store
                .profile(pubkey)
                .and_then(|p| p.label().map(str::to_owned))
        })
        .unwrap_or_else(|| short_npub(pubkey))
}

fn hue(pubkey: &str) -> u32 {
    pubkey.bytes().take(6).fold(0u32, |acc, b| {
        acc.wrapping_mul(31).wrapping_add(u32::from(b))
    }) % 360
}

#[component]
pub fn Avatar(pubkey: String, #[prop(default = "avatar")] class: &'static str) -> impl IntoView {
    let ui = Ui::get();
    let key = pubkey.clone();
    let picture = Memo::new(move |_| {
        ui.app.rev.track();
        ui.app
            .with(|rt| rt.store.profile(&key).map(|p| p.picture.clone()))
            .unwrap_or_default()
    });
    let failed = RwSignal::new(false);
    let style = format!("--hue: {}", hue(&pubkey));
    let initial = move || {
        name_of(ui, &pubkey)
            .chars()
            .next()
            .unwrap_or('?')
            .to_uppercase()
            .to_string()
    };
    view! {
        <span class=class style=style aria-hidden="true">
            {move || {
                let src = picture.get();
                if src.is_empty() || failed.get() {
                    initial().into_any()
                } else {
                    view! { <img src=src alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" on:error=move |_| failed.set(true)/> }.into_any()
                }
            }}
        </span>
    }
}

/// `imeta` dimensions for a URL, as a CSS aspect ratio.
fn aspect(event: &Event, url: &str) -> Option<String> {
    event
        .tags
        .iter()
        .filter(|t| t.first().is_some_and(|n| n == "imeta"))
        .find_map(|tag| {
            tag.iter()
                .any(|part| part == &format!("url {url}"))
                .then_some(())?;
            let dim = tag.iter().find_map(|part| part.strip_prefix("dim "))?;
            let (w, h) = dim.split_once('x')?;
            let (w, h): (f64, f64) = (w.parse().ok()?, h.parse().ok()?);
            (w > 0.0 && h > 0.0).then(|| format!("--ar: {w} / {h}"))
        })
}

fn link_label(url: &str) -> String {
    let bare = url
        .trim_start_matches("https://")
        .trim_start_matches("http://");
    if bare.chars().count() > 48 {
        format!("{}…", bare.chars().take(46).collect::<String>())
    } else {
        bare.to_owned()
    }
}

fn emoji_of(event: &Event) -> Vec<(String, String)> {
    event
        .tags
        .iter()
        .filter(|t| t.first().is_some_and(|n| n == "emoji") && t.len() >= 3)
        .map(|t| (t[1].clone(), t[2].clone()))
        .collect()
}

#[component]
pub fn Content(event: Event, #[prop(default = false)] compact: bool) -> impl IntoView {
    let ui = Ui::get();
    let warning =
        has_content_warning(&event).then(|| content_warning_reason(&event).unwrap_or_default());
    let revealed = RwSignal::new(warning.is_none());
    let parts = segments(&event.content, &emoji_of(&event));
    let body = parts
        .into_iter()
        .map(|segment| match segment {
            Segment::Text(text) => text.into_any(),
            Segment::Link(url) => view! {
                <a href=url.clone() target="_blank" rel="noopener noreferrer nofollow" on:click=|ev| ev.stop_propagation()>{link_label(&url)}</a>
            }
            .into_any(),
            Segment::Image(url) if !compact => {
                let style = aspect(&event, &url).unwrap_or_default();
                view! {
                    <a class="media" href=url.clone() target="_blank" rel="noopener noreferrer" style=style on:click=|ev| ev.stop_propagation()>
                        <img src=url.clone() alt="Image" loading="lazy" decoding="async" referrerpolicy="no-referrer"/>
                    </a>
                }
                .into_any()
            }
            Segment::Video(url) if !compact => view! {
                <video class="media" src=url controls preload="none" on:click=|ev| ev.stop_propagation()></video>
            }
            .into_any(),
            Segment::Image(url) | Segment::Video(url) => view! {
                <a href=url.clone() target="_blank" rel="noopener noreferrer" on:click=|ev| ev.stop_propagation()>"[media]"</a>
            }
            .into_any(),
            Segment::Mention(pubkey) => {
                let key = pubkey.clone();
                view! {
                    <button class="mention" on:click=move |ev| { ev.stop_propagation(); ui.open_profile(&key); }>
                        "@" {move || name_of(ui, &pubkey)}
                    </button>
                }
                .into_any()
            }
            Segment::Quote { id, relays } if !compact => view! { <super::reference::Quote id=id relays=relays/> }.into_any(),
            Segment::Quote { id, relays } => view! {
                <button class="mention" on:click=move |ev| { ev.stop_propagation(); ui.open_thread(&id, relays.clone()); }>"[quoted note]"</button>
            }
            .into_any(),
            Segment::Hashtag(tag) => {
                let query = format!("#{tag}");
                view! {
                    <button class="tag" on:click=move |ev| { ev.stop_propagation(); ui.open(View::Search { query: query.clone() }, Open::Beside); }>
                        "#" {tag}
                    </button>
                }
                .into_any()
            }
            Segment::Emoji { code, url } => view! {
                <img class="emoji" src=url alt=format!(":{code}:") title=format!(":{code}:") loading="lazy"/>
            }
            .into_any(),
        })
        .collect_view();
    view! {
        <div class="content" class:compact=compact class:veiled=move || !revealed.get()>
            {warning.map(|reason| view! {
                <Show when=move || !revealed.get()>
                    <button class="veil" on:click=move |ev| { ev.stop_propagation(); revealed.set(true); }>
                        {if reason.is_empty() { "Sensitive content · show".to_owned() } else { format!("{reason} · show") }}
                    </button>
                </Show>
            })}
            <div class="text">{body}</div>
        </div>
    }
}
