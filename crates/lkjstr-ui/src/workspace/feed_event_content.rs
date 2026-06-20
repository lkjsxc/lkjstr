use leptos::prelude::*;
use lkjstr_app::feed::{
    FeedEventContent, FeedEventContentRow, FeedEventCustomEmoji, FeedEventUnavailablePreview,
};

#[path = "feed_event_content_plan.rs"]
mod feed_event_content_plan;

use super::feed_event_link::event_link;
use super::feed_event_media::media_attachment;
use super::feed_event_profile_mention::profile_mention;
use super::feed_event_reference::reference_unavailable;
use super::feed_event_repost_target::{repost_target, repost_target_shell};
use super::feed_event_sensitive::sensitive_warning;
use feed_event_content_plan::{FeedEventContentRowRenderPlan, content_row_render_plan};

#[derive(Clone, Debug, Eq, PartialEq)]
struct CustomEmojiImageAttrs {
    row_key: String,
    item_index: String,
    class_name: &'static str,
    src: String,
    alt: String,
    title: String,
    fallback_text: String,
    address: String,
    loading: &'static str,
    decoding: &'static str,
    referrer_policy: &'static str,
}
#[derive(Clone, Debug, Eq, PartialEq)]
struct UnavailablePreviewAttrs {
    row_key: String,
    segment_index: String,
    label: &'static str,
}

pub(crate) fn event_content_with_openers(
    content: FeedEventContent,
    open_profile: Option<Callback<String>>,
    open_thread: Option<Callback<String>>,
) -> AnyView {
    match content {
        FeedEventContent::Sensitive { reason, rows } => {
            sensitive_content(reason, rows, open_profile, open_thread)
        }
        FeedEventContent::Rows(rows) => text_rows_view(rows, open_profile, open_thread),
    }
}

fn sensitive_content(
    reason: Option<String>,
    rows: Vec<FeedEventContentRow>,
    open_profile: Option<Callback<String>>,
    open_thread: Option<Callback<String>>,
) -> AnyView {
    let revealed = RwSignal::new(false);
    view! {
        {move || {
            if revealed.get() {
                text_rows_view(rows.clone(), open_profile, open_thread).into_any()
            } else {
                sensitive_warning(reason.clone(), revealed).into_any()
            }
        }}
    }
    .into_any()
}

fn text_rows_view(
    rows: Vec<FeedEventContentRow>,
    open_profile: Option<Callback<String>>,
    open_thread: Option<Callback<String>>,
) -> AnyView {
    rows.into_iter()
        .map(|row| content_row(row, open_profile, open_thread))
        .collect_view()
        .into_any()
}

fn content_row(
    row: FeedEventContentRow,
    open_profile: Option<Callback<String>>,
    open_thread: Option<Callback<String>>,
) -> AnyView {
    let plan = content_row_render_plan(row);
    let openers = plan.openers();
    let profile_opener = openers.profile.then_some(open_profile).flatten();
    let thread_opener = openers.thread.then_some(open_thread).flatten();
    match plan {
        FeedEventContentRowRenderPlan::Text(text) => view! { <p>{text}</p> }.into_any(),
        FeedEventContentRowRenderPlan::Link(link) => event_link(link).into_any(),
        FeedEventContentRowRenderPlan::ProfileMention(mention) => {
            profile_mention(mention, profile_opener).into_any()
        }
        FeedEventContentRowRenderPlan::CustomEmoji(emoji) => custom_emoji(emoji).into_any(),
        FeedEventContentRowRenderPlan::MediaAttachment(media) => media_attachment(media).into_any(),
        FeedEventContentRowRenderPlan::RepostTarget(target) => {
            repost_target(target, profile_opener, thread_opener)
        }
        FeedEventContentRowRenderPlan::RepostTargetShell(shell) => {
            repost_target_shell(shell).into_any()
        }
        FeedEventContentRowRenderPlan::MediaPreviewUnavailable(preview) => {
            unavailable_preview(preview, "Media preview unavailable").into_any()
        }
        FeedEventContentRowRenderPlan::ReferenceUnavailable(reference) => {
            reference_unavailable(reference, thread_opener).into_any()
        }
        FeedEventContentRowRenderPlan::ReferencePreviewUnavailable(preview) => {
            unavailable_preview(preview, "Reference preview unavailable").into_any()
        }
    }
}

fn unavailable_preview(preview: FeedEventUnavailablePreview, label: &'static str) -> impl IntoView {
    let attrs = unavailable_preview_attrs(preview, label);
    view! {
        <p
            data-row-key=attrs.row_key
            data-segment-index=attrs.segment_index
        >
            {attrs.label}
        </p>
    }
}

fn unavailable_preview_attrs(
    preview: FeedEventUnavailablePreview,
    label: &'static str,
) -> UnavailablePreviewAttrs {
    UnavailablePreviewAttrs {
        row_key: preview.row_key,
        segment_index: preview.segment_index.to_string(),
        label,
    }
}

fn custom_emoji(emoji: FeedEventCustomEmoji) -> impl IntoView {
    let attrs = custom_emoji_image_attrs(&emoji);
    let failed = RwSignal::new(false);
    view! {
        <p>
            {move || {
                if failed.get() {
                    custom_emoji_fallback(&attrs).into_any()
                } else {
                    custom_emoji_image(&attrs, failed).into_any()
                }
            }}
        </p>
    }
}

fn custom_emoji_fallback(attrs: &CustomEmojiImageAttrs) -> impl IntoView {
    view! { <span class="custom-emoji-fallback">{attrs.fallback_text.clone()}</span> }
}

fn custom_emoji_image(attrs: &CustomEmojiImageAttrs, failed: RwSignal<bool>) -> impl IntoView {
    let mark_failed = move |_| failed.set(true);
    view! {
        <img
            class=attrs.class_name
            src=attrs.src.clone()
            alt=attrs.alt.clone()
            title=attrs.title.clone()
            data-address=attrs.address.clone()
            data-row-key=attrs.row_key.clone()
            data-item-index=attrs.item_index.clone()
            loading=attrs.loading
            decoding=attrs.decoding
            referrerpolicy=attrs.referrer_policy
            on:error=mark_failed
        />
    }
}

fn custom_emoji_image_attrs(emoji: &FeedEventCustomEmoji) -> CustomEmojiImageAttrs {
    let token = format!(":{}:", emoji.shortcode);
    CustomEmojiImageAttrs {
        row_key: emoji.row_key.clone(),
        item_index: emoji.item_index.to_string(),
        class_name: "custom-emoji",
        src: emoji.url.clone(),
        alt: token.clone(),
        title: token,
        fallback_text: format!(":{}:", emoji.shortcode),
        address: emoji.address.clone().unwrap_or_default(),
        loading: "lazy",
        decoding: "async",
        referrer_policy: "no-referrer",
    }
}
#[cfg(test)]
#[path = "feed_event_content_tests.rs"]
mod tests;
