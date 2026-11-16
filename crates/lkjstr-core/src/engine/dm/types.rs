//! Private message protocol data. Debug deliberately omits message bodies.
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

#[derive(Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Query {
    pub account: String,
    pub conversation: Option<String>,
    pub before: Option<String>,
    pub limit: Option<usize>,
}
#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Draft {
    pub recipients: Vec<String>,
    pub text: String,
    pub reply_to: Option<String>,
    pub subject: Option<String>,
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
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Conversation {
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
