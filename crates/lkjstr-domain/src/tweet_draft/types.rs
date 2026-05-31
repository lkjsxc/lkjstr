use lkjstr_protocol::CustomEmoji;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TweetDraft {
    pub id: String,
    pub account_id: Option<String>,
    pub content: String,
    #[serde(default)]
    pub attachments: Vec<TweetAttachment>,
    #[serde(default)]
    pub custom_emojis: Vec<CustomEmoji>,
    #[serde(default)]
    pub sensitive: bool,
    #[serde(default)]
    pub content_warning_reason: String,
    pub updated_at: u64,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TweetAttachment {
    pub url: String,
    pub name: String,
    #[serde(rename = "type")]
    pub media_type: String,
    pub tags: Vec<Vec<String>>,
    pub imeta: Vec<String>,
}

#[must_use]
pub fn tweet_draft_id_for_tab(tab_id: &str) -> String {
    format!("tab:{tab_id}")
}

#[must_use]
pub fn empty_tweet_draft(id: impl Into<String>, now: u64) -> TweetDraft {
    create_tweet_draft(id, None, "", now)
}

#[must_use]
pub fn create_tweet_draft(
    id: impl Into<String>,
    account_id: Option<String>,
    content: impl Into<String>,
    updated_at: u64,
) -> TweetDraft {
    TweetDraft {
        id: id.into(),
        account_id,
        content: content.into(),
        attachments: Vec::new(),
        custom_emojis: Vec::new(),
        sensitive: false,
        content_warning_reason: String::new(),
        updated_at,
    }
}

#[must_use]
pub fn tweet_draft_has_body(draft: &TweetDraft) -> bool {
    !draft.content.trim().is_empty() || !draft.attachments.is_empty()
}
