use lkjstr_protocol::NostrFilter;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PublicChatQueryInput {
    pub selected_read_relays: Vec<String>,
    pub relay_hints: Vec<String>,
    pub channel_ids: Vec<String>,
    pub selected_channel_id: Option<String>,
    pub active_pubkey: Option<String>,
    pub loaded_message_ids: Vec<String>,
    pub loaded_author_pubkeys: Vec<String>,
    pub limit: u64,
    pub max_hint_relays: usize,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PublicChatReadPlan {
    pub demand_key: String,
    pub relays: Vec<String>,
    pub filters: Vec<NostrFilter>,
}

impl PublicChatQueryInput {
    #[must_use]
    pub fn with_selected_read_relays(relays: Vec<String>) -> Self {
        Self {
            selected_read_relays: relays,
            relay_hints: Vec::new(),
            channel_ids: Vec::new(),
            selected_channel_id: None,
            active_pubkey: None,
            loaded_message_ids: Vec::new(),
            loaded_author_pubkeys: Vec::new(),
            limit: 50,
            max_hint_relays: 4,
        }
    }
}
