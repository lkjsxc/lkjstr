use lkjstr_protocol::custom_emoji_token_text;

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum FeedEventContentRow {
    Text(String),
    CustomEmoji(FeedEventCustomEmoji),
    MediaPreviewUnavailable(FeedEventUnavailablePreview),
    ReferencePreviewUnavailable(FeedEventUnavailablePreview),
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeedEventCustomEmoji {
    pub shortcode: String,
    pub url: String,
    pub address: Option<String>,
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
            Self::CustomEmoji(emoji) => custom_emoji_token_text(&emoji.shortcode),
            Self::MediaPreviewUnavailable(_) => "Media preview unavailable".to_owned(),
            Self::ReferencePreviewUnavailable(_) => "Reference preview unavailable".to_owned(),
        }
    }
}
