use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct PublicChatMessage {
    pub event_id: String,
    pub channel_id: String,
    pub pubkey: String,
    pub created_at: u64,
    pub content: String,
    pub reply_to: Option<String>,
    pub relay_urls: Vec<String>,
    pub hidden: bool,
    pub muted_author: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct PublishRelayResult {
    pub succeeded: Vec<String>,
    pub failed: Vec<String>,
}

#[derive(Clone, Debug, Default, Eq, PartialEq, Serialize, Deserialize)]
pub enum PublicChatPublishState {
    #[default]
    Idle,
    Queued {
        event_id: String,
    },
    Partial {
        event_id: String,
        result: PublishRelayResult,
    },
    Failed {
        reason: String,
    },
}

impl PublicChatMessage {
    #[must_use]
    pub fn from_event(
        event: &lkjstr_protocol::NostrEvent,
        channel_id: String,
        relay_urls: Vec<String>,
        hidden: bool,
        muted_author: bool,
    ) -> Self {
        Self {
            event_id: event.id.clone(),
            channel_id,
            pubkey: event.pubkey.clone(),
            created_at: event.created_at,
            content: event.content.clone(),
            reply_to: lkjstr_protocol::channel_reply_event_id(event).map(str::to_owned),
            relay_urls,
            hidden,
            muted_author,
        }
    }
}
