use serde::{Deserialize, Serialize};

use crate::public_chat::{PublicChatChannel, PublicChatMessage, PublicChatPublishState};

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub enum PublicChatLoadingState {
    Idle,
    NoRelaysSelected,
    LoadingChannels,
    LoadingMessages { channel_id: String },
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct PublicChatState {
    pub channels: Vec<PublicChatChannel>,
    pub selected_channel_id: Option<String>,
    pub messages: Vec<PublicChatMessage>,
    pub loading: PublicChatLoadingState,
    pub composer_draft: String,
    pub publish: PublicChatPublishState,
    pub diagnostics: Vec<String>,
    pub hidden_message_ids: Vec<String>,
    pub muted_pubkeys: Vec<String>,
}

#[must_use]
pub fn empty_public_chat_state() -> PublicChatState {
    PublicChatState {
        channels: Vec::new(),
        selected_channel_id: None,
        messages: Vec::new(),
        loading: PublicChatLoadingState::Idle,
        composer_draft: String::new(),
        publish: PublicChatPublishState::Idle,
        diagnostics: Vec::new(),
        hidden_message_ids: Vec::new(),
        muted_pubkeys: Vec::new(),
    }
}
