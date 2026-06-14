#[derive(Clone, Debug, Eq, PartialEq)]
pub enum EventReferenceKind {
    ReplyRoot,
    ReplyParent,
    Quote,
    Repost,
    Reaction,
    Deletion,
    NostrEvent,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum EventReferenceSource {
    E,
    Q,
    Content,
    Repost,
    Reaction,
    Deletion,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventReference {
    pub kind: EventReferenceKind,
    pub id: String,
    pub relays: Vec<String>,
    pub author_pubkey: Option<String>,
    pub marker: Option<String>,
    pub source: EventReferenceSource,
}
