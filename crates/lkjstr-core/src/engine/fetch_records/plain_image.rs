//! Page observation input: only public image classes, bounded identity, no private data.
use super::*;
use serde::Deserialize;
#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ImageClass {
    Avatars,
    Media,
    Emoji,
}
#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ImageSlot {
    Avatar,
    NoteImage,
    MediaView,
    Poster,
    LinkPicture,
    MediaPlayback,
    Emoji,
}
#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ImageOutcome {
    Ok,
    NetworkError,
    Timeout,
    Cancelled,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlainImage {
    class: ImageClass,
    slot: ImageSlot,
    view: Option<String>,
    lane: Lane,
    url: String,
    start_ms: u64,
    end_ms: u64,
    display_size: Option<(u32, u32)>,
    first_visible_ms: Option<u64>,
    outcome: ImageOutcome,
}
impl Observer {
    pub fn plain_image(&self, image: PlainImage) {
        if image.url.len() > 2048
            || image.end_ms < image.start_ms
            || image.view.as_ref().is_some_and(|v| v.len() > 128)
        {
            return;
        }
        let Ok(url) = url::Url::parse(&image.url) else {
            return;
        };
        if !matches!(url.scheme(), "http" | "https")
            || url.username() != ""
            || url.password().is_some()
            || !url.has_host()
        {
            return;
        }
        let class = match image.class {
            ImageClass::Avatars => ResourceClass::Avatars,
            ImageClass::Media => ResourceClass::Media,
            ImageClass::Emoji => ResourceClass::Emoji,
        };
        let Some(mut r) = self.draft(
            class,
            Scope::Resource,
            &image.url,
            Some(&image.url),
            image.end_ms,
        ) else {
            return;
        };
        r.lane = image.lane;
        r.start_ms = Some(image.start_ms);
        r.source = Source::NetworkOrHttpCache;
        r.display_size = image
            .display_size
            .filter(|&(w, h)| (1..=16384).contains(&w) && (1..=16384).contains(&h));
        r.first_visible_ms = image.first_visible_ms.filter(|&at| at <= image.end_ms);
        r.view = image.view.as_deref().and_then(|s| self.key(s));
        r.slot = self.key(match image.slot {
            ImageSlot::Avatar => "avatar",
            ImageSlot::NoteImage => "note-image",
            ImageSlot::MediaView => "media-view",
            ImageSlot::Poster => "poster",
            ImageSlot::LinkPicture => "link-picture",
            ImageSlot::MediaPlayback => "media-playback",
            ImageSlot::Emoji => "emoji",
        });
        r.outcome = match image.outcome {
            ImageOutcome::Ok => Outcome::Ok,
            ImageOutcome::NetworkError => Outcome::NetworkError,
            ImageOutcome::Timeout => Outcome::Timeout,
            ImageOutcome::Cancelled => Outcome::Cancelled,
        };
        self.record(r);
    }
}
