//! Private message protocol data. Debug deliberately omits message bodies.
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

#[derive(Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Query {
    pub account: String,
    pub conversation: Option<String>,
    pub participants: Option<Vec<String>>,
    pub before: Option<String>,
    pub limit: Option<usize>,
    #[serde(default)]
    pub unread_only: bool,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Draft {
    pub recipients: Vec<String>,
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reply_to: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subject: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub emoji: Option<Vec<Emoji>>,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct Emoji {
    pub code: String,
    pub url: String,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Message {
    pub id: String,
    pub conversation: String,
    pub author: String,
    pub participants: Vec<String>,
    pub at: u64,
    pub text: String,
    pub reply_to: Option<String>,
    pub subject: Option<String>,
    pub legacy: bool,
    pub unread: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub segments: Option<Vec<serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reply: Option<Reply>,
}
#[derive(Clone, Serialize)]
pub struct Reply {
    pub id: String,
    pub author: String,
    pub excerpt: String,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Conversation {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recent_authors: Option<Vec<String>>,
    pub key: String,
    pub participants: Vec<String>,
    pub last: Message,
    pub unread: usize,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub account: String,
    pub conversations: Vec<Conversation>,
    pub messages: Vec<Message>,
    pub more: bool,
    pub undecryptable: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conversation: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub people: Option<Vec<serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub blocked: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unread: Option<usize>,
    pub phase: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}
/// A timestamp watermark includes the IDs already seen at that timestamp.
#[derive(Clone, Default, Serialize, Deserialize)]
pub struct Mark {
    pub at: u64,
    pub ids: BTreeSet<String>,
}
impl std::fmt::Debug for Query {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("DmQuery [redacted]")
    }
}
impl std::fmt::Debug for Draft {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("DmDraft [redacted]")
    }
}
