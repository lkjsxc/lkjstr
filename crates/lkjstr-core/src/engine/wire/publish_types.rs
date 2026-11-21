use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(tag = "k", rename_all = "camelCase")]
pub enum Publish {
    Note {
        draft: Box<Draft>,
    },
    Repost {
        id: String,
    },
    Reaction {
        id: String,
        emoji: String,
        url: Option<String>,
        address: Option<String>,
    },
    Delete {
        id: String,
        of: Option<String>,
        emoji: Option<String>,
        url: Option<String>,
    },
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Mention {
    pub start: usize,
    pub end: usize,
    pub pubkey: String,
    pub label: String,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Draft {
    pub mentions: Option<Vec<Mention>>,
    pub text: String,
    pub channel: Option<String>,
    pub long_form: Option<LongForm>,
    pub reply_to: Option<String>,
    pub quote: Option<String>,
    pub media: Option<Vec<Uploaded>>,
    pub cw: Option<String>,
    pub emoji: Option<Vec<Emoji>>,
}
#[derive(Debug, Deserialize)]
pub struct Uploaded {
    pub url: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub mime: String,
    pub w: Option<u32>,
    pub h: Option<u32>,
    pub sha256: Option<String>,
    pub alt: Option<String>,
}
#[derive(Debug, Deserialize)]
pub struct Emoji {
    pub code: String,
    pub url: String,
    pub address: Option<String>,
}
#[derive(Debug, Deserialize)]
pub struct LongForm {
    pub identifier: String,
    pub title: Option<String>,
}
