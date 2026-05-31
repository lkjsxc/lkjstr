#![doc = "Relay subscription id helpers."]

use sha2::{Digest, Sha256};

pub const fn max_relay_subscription_id_length() -> usize {
    48
}

#[must_use]
pub fn relay_subscription_hash(value: &str, length: usize) -> String {
    let digest = Sha256::digest(value.as_bytes());
    let hex = bytes_to_hex(&digest);
    let end = length.min(hex.len());
    hex[..end].to_owned()
}

#[must_use]
pub fn compact_relay_subscription_id(
    prefix: &str,
    topic: &str,
    discriminator: Option<&str>,
) -> String {
    let id = match discriminator {
        Some(value) if !value.is_empty() => {
            format!("{prefix}:{topic}:{}", relay_subscription_hash(value, 12))
        }
        _ => format!("{prefix}:{topic}"),
    };
    if id.len() <= max_relay_subscription_id_length() {
        return id;
    }
    format!(
        "{}:{}:{}",
        prefix.chars().take(8).collect::<String>(),
        topic.chars().take(10).collect::<String>(),
        relay_subscription_hash(&id, 16)
    )
}

#[must_use]
pub fn child_relay_subscription_id(
    parent: &str,
    topic: &str,
    discriminator: Option<&str>,
) -> String {
    compact_relay_subscription_id(parent, topic, discriminator)
}

#[must_use]
pub fn live_relay_subscription_id(prefix: &str, topic: &str) -> String {
    compact_relay_subscription_id(prefix, topic, None)
}

#[must_use]
pub fn initial_relay_subscription_id(prefix: &str, discriminator: Option<&str>) -> String {
    compact_relay_subscription_id(prefix, "initial", discriminator)
}

#[must_use]
pub fn older_relay_subscription_id(prefix: &str, cursor: &str) -> String {
    compact_relay_subscription_id(prefix, "older", Some(cursor))
}

#[must_use]
pub fn newer_relay_subscription_id(prefix: &str, cursor: &str) -> String {
    compact_relay_subscription_id(prefix, "newer", Some(cursor))
}

#[must_use]
pub fn relay_subscription_id_valid(id: &str) -> bool {
    !id.is_empty() && id.len() <= max_relay_subscription_id_length()
}

fn bytes_to_hex(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        out.push(hex_char(byte >> 4));
        out.push(hex_char(byte & 0x0f));
    }
    out
}

const fn hex_char(value: u8) -> char {
    match value {
        0..=9 => (b'0' + value) as char,
        _ => (b'a' + value - 10) as char,
    }
}
