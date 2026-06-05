#![doc = "Pure Public Chat domain state."]

mod channel;
mod filter;
mod message;
mod reducer;
mod state;

pub use channel::{PublicChatChannel, PublicChatMetadata};
pub use filter::{newest_channel_first_key, sort_channels, sort_messages};
pub use message::{PublicChatMessage, PublicChatPublishState, PublishRelayResult};
pub use reducer::{
    apply_own_hide_events, apply_own_mute_events, mark_publish_queued, merge_channel_create,
    merge_channel_messages, merge_channel_metadata, merge_publish_result, reset_on_tab_close,
    select_channel, set_composer_text,
};
pub use state::{PublicChatLoadingState, PublicChatState, empty_public_chat_state};
