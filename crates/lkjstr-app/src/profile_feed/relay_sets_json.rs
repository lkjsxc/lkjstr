use lkjstr_domain::{RelayRecord, RelaySet};
use lkjstr_protocol::normalize_relay_url;
use serde_json::{Value, json};

#[must_use]
pub fn relay_sets_copy_json(sets: &[RelaySet]) -> String {
    let value = sets.iter().map(relay_set_json).collect::<Vec<_>>();
    match serde_json::to_string_pretty(&value) {
        Ok(text) => text,
        Err(_) => "[]".to_owned(),
    }
}

fn relay_set_json(set: &RelaySet) -> Value {
    json!({
        "id": &set.id,
        "name": &set.name,
        "default": set.is_default.unwrap_or(false),
        "relays": set.relays.iter().map(relay_json).collect::<Vec<_>>(),
    })
}

fn relay_json(relay: &RelayRecord) -> Value {
    json!({
        "url": normalize_relay_url(&relay.url).unwrap_or_else(|| relay.url.clone()),
        "enabled": relay.enabled,
        "read": relay.read,
        "write": relay.write,
    })
}
