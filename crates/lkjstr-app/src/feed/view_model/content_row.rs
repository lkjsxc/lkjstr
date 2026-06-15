use lkjstr_protocol::custom_emoji_token_text;

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum FeedEventContentRow {
    Text(String),
    Link(FeedEventLink),
    ProfileMention(FeedEventProfileMention),
    CustomEmoji(FeedEventCustomEmoji),
    MediaAttachment(FeedEventMediaAttachment),
    MediaPreviewUnavailable(FeedEventUnavailablePreview),
    ReferenceUnavailable(FeedEventReferenceUnavailable),
    ReferencePreviewUnavailable(FeedEventUnavailablePreview),
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeedEventProfileMention {
    pub pubkey: String,
    pub relays: Vec<String>,
    pub raw_text: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeedEventLink {
    pub url: String,
    pub text: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeedEventCustomEmoji {
    pub shortcode: String,
    pub url: String,
    pub address: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeedEventMediaAttachment {
    pub row_key: String,
    pub item_index: u16,
    pub url: String,
    pub kind: FeedEventMediaKind,
    pub aspect_ratio: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum FeedEventMediaKind {
    Image,
    Video,
    Audio,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeedEventReferenceUnavailable {
    pub row_key: String,
    pub segment_index: u16,
    pub event_id: String,
    pub kind: FeedEventReferenceKind,
    pub relays: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum FeedEventReferenceKind {
    ReplyRoot,
    ReplyParent,
    Quote,
    Repost,
    Reaction,
    Deletion,
    NostrEvent,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeedEventUnavailablePreview {
    pub row_key: String,
    pub segment_index: u16,
}

impl FeedEventContentRow {
    #[must_use]
    pub fn text(&self) -> String {
        match self {
            Self::Text(text) => text.clone(),
            Self::Link(link) => link.text.clone(),
            Self::ProfileMention(mention) => mention.raw_text.clone(),
            Self::CustomEmoji(emoji) => custom_emoji_token_text(&emoji.shortcode),
            Self::MediaAttachment(media) => media.url.clone(),
            Self::MediaPreviewUnavailable(_) => "Media preview unavailable".to_owned(),
            Self::ReferenceUnavailable(reference) => reference.event_id.clone(),
            Self::ReferencePreviewUnavailable(_) => "Reference preview unavailable".to_owned(),
        }
    }
}
