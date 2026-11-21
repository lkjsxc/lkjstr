use super::Engine;
use lkjstr_protocol::UnsignedNostrEvent;

// NIP-89 handler read back from Ditto under this exact author and d tag.
pub(super) const ADDRESS: &str =
    "31990:160b7d028b99ef2530be8718d03cb0be6f9449fb74d5ae8d6f09a060c63048b1:lkjstr";
pub(super) const RELAY: &str = "wss://relay.ditto.pub/";

impl Engine {
    pub(super) fn apply_client_tag(&self, event: &mut UnsignedNostrEvent) {
        event
            .tags
            .retain(|t| t.first().is_none_or(|k| k != "client"));
        let enabled = self
            .client_tag_accounts
            .get(&event.pubkey)
            .copied()
            .unwrap_or(self.client_tag);
        if enabled && matches!(event.kind, 1 | 6 | 7 | 16 | 40 | 41 | 42 | 30023) {
            event.tags.push(
                ["client", "lkjstr", ADDRESS, RELAY]
                    .map(String::from)
                    .into(),
            );
        }
    }
}
