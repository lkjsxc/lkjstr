use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Default, Eq, PartialEq, Serialize, Deserialize)]
pub struct PublicChatMetadata {
    pub name: Option<String>,
    pub about: Option<String>,
    pub picture: Option<String>,
    pub relays: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct PublicChatChannel {
    pub id: String,
    pub creator_pubkey: String,
    pub created_at: u64,
    pub metadata: PublicChatMetadata,
    pub metadata_event_id: Option<String>,
    pub metadata_updated_at: Option<u64>,
    pub relay_hints: Vec<String>,
    pub last_message_at: Option<u64>,
}

impl From<lkjstr_protocol::ChannelMetadata> for PublicChatMetadata {
    fn from(value: lkjstr_protocol::ChannelMetadata) -> Self {
        Self {
            name: value.name,
            about: value.about,
            picture: value.picture,
            relays: value.relays,
        }
    }
}

impl PublicChatChannel {
    #[must_use]
    pub fn from_create(event: &lkjstr_protocol::NostrEvent) -> Self {
        let metadata = lkjstr_protocol::parse_channel_create_metadata(event)
            .map(PublicChatMetadata::from)
            .unwrap_or_default();
        let relay_hints = metadata.relays.clone();
        Self {
            id: event.id.clone(),
            creator_pubkey: event.pubkey.clone(),
            created_at: event.created_at,
            metadata,
            metadata_event_id: None,
            metadata_updated_at: None,
            relay_hints,
            last_message_at: None,
        }
    }
}
