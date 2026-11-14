//! NIP-30 names use only validated kind-0 emoji tags, never HTML.
use super::{Ui, note_parts::name_of};
use leptos::prelude::*;
use lkjstr_core::content::Segment;
#[component]
pub fn Name(pubkey: String) -> impl IntoView {
    let ui = Ui::get();
    move || {
        let label = name_of(ui, &pubkey);
        let emoji = ui
            .app
            .with(|rt| rt.store.replaceable(&pubkey, 0))
            .map(|event| lkjstr_protocol::custom_emojis(&event))
            .unwrap_or_default();
        let emoji: Vec<_> = emoji.into_iter().map(|e| (e.shortcode, e.url)).collect();
        lkjstr_core::reading::name_parts(&label, &emoji)
            .into_iter()
            .map(|part| match part {
                Segment::Emoji { code, url } => {
                    view! { <img class="emoji" src=url alt=format!(":{code}:")/> }.into_any()
                }
                Segment::Text(text) => text.into_any(),
                _ => ().into_any(),
            })
            .collect_view()
    }
}
