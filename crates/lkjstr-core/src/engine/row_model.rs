use serde::{Deserialize, Serialize};
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Author {
    pub pubkey: String,
    pub name: String,
    pub picture: Option<String>,
    pub nip05: Option<String>,
    pub nip05_verified: bool,
    pub name_segments: Vec<NameSegment>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Segment {
    Text {
        text: String,
    },
    Link {
        url: String,
    },
    Hashtag {
        tag: String,
    },
    Mention {
        author: Author,
    },
    Emoji {
        code: String,
        url: String,
    },
    Media {
        url: String,
        kind: String,
        width: Option<u32>,
        height: Option<u32>,
        alt: Option<String>,
    },
    Quote {
        id: String,
        row: Option<Box<Row>>,
    },
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Row {
    pub id: String,
    pub author: Author,
    pub created_at: u64,
    pub kind: u64,
    pub content: Vec<Segment>,
    pub reply: Option<Context>,
    pub reposts: Vec<Author>,
    pub warning: Option<String>,
    pub counts: Counts,
    pub reactions: Vec<Reaction>,
    pub own: Own,
    pub hidden_reason: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Context {
    pub id: String,
    pub author: Option<Author>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Counts {
    pub replies: usize,
    pub reposts: usize,
    pub reactions: usize,
    pub partial: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Reaction {
    pub content: String,
    pub url: Option<String>,
    pub count: usize,
    pub mine: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Own {
    pub reposted: bool,
    pub bookmarked: bool,
    pub muted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum NameSegment {
    Text { text: String },
    Emoji { code: String, url: String },
}
