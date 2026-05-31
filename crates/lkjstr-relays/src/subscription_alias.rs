#![doc = "Relay subscription id aliases."]

use std::collections::HashMap;

use crate::subscription_id::{max_relay_subscription_id_length, relay_subscription_hash};

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct RelaySubscriptionAliases {
    logical_to_wire: HashMap<String, String>,
    wire_to_logical: HashMap<String, String>,
}

impl RelaySubscriptionAliases {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    pub fn wire_id(&mut self, logical_id: &str, max_length: usize) -> String {
        if let Some(existing) = self.logical_to_wire.get(logical_id)
            && existing.len() <= max_length
        {
            return existing.clone();
        }

        let wire = if logical_id.len() <= max_length {
            logical_id.to_owned()
        } else {
            alias(logical_id, max_length)
        };
        self.logical_to_wire
            .insert(logical_id.to_owned(), wire.clone());
        self.wire_to_logical
            .insert(wire.clone(), logical_id.to_owned());
        wire
    }

    #[must_use]
    pub fn logical_id(&self, wire_id: &str) -> String {
        self.wire_to_logical
            .get(wire_id)
            .cloned()
            .unwrap_or_else(|| wire_id.to_owned())
    }

    pub fn forget(&mut self, logical_id: &str) {
        if let Some(wire) = self.logical_to_wire.remove(logical_id) {
            self.wire_to_logical.remove(&wire);
        }
    }

    pub fn clear(&mut self) {
        self.logical_to_wire.clear();
        self.wire_to_logical.clear();
    }
}

fn alias(logical_id: &str, max_length: usize) -> String {
    let length = max_length.clamp(8, max_relay_subscription_id_length());
    relay_subscription_hash(logical_id, length)
}
