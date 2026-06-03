use super::types::{RelayConnectionState, RelayHealth, RelayPurpose, RelayRecord, RelaySet};

const DEFAULT_RELAYS: &[(&str, &str)] = &[
    ("wss://relay.damus.io", "Damus"),
    ("wss://nos.lol", "nos.lol"),
    ("wss://relay.primal.net", "Primal"),
    ("wss://offchain.pub", "Offchain"),
    ("wss://r.kojira.io", "Kojira"),
    ("wss://x.kojira.io", "Kojira X"),
    ("wss://yabu.me", "Yabumi"),
    ("wss://relay-jp.nostr.wirednet.jp", "Kiri Japan"),
    ("wss://relay.nostr.wirednet.jp", "Kiri World"),
];

const DEFAULT_DISCOVERY_RELAYS: &[(&str, &str)] = &[
    ("wss://purplepag.es/", "purplepag.es"),
    ("wss://directory.yabu.me/", "Yabumi Directory"),
];

#[must_use]
pub fn default_user_relay_set(now: u64) -> RelaySet {
    default_set(
        "public-default",
        "Public Default",
        RelayPurpose::User,
        true,
        DEFAULT_RELAYS,
        now,
    )
}

#[must_use]
pub fn default_discovery_relay_set(now: u64) -> RelaySet {
    default_set(
        "discovery-default",
        "Discovery Default",
        RelayPurpose::Discovery,
        false,
        DEFAULT_DISCOVERY_RELAYS,
        now,
    )
}

pub fn create_relay(url: &str, now: u64) -> RelayRecord {
    relay_with_label(url, &label_for_url(url), now)
}

fn default_set(
    id: &str,
    name: &str,
    purpose: RelayPurpose,
    default: bool,
    relays: &[(&str, &str)],
    now: u64,
) -> RelaySet {
    RelaySet {
        id: id.to_owned(),
        name: name.to_owned(),
        purpose,
        is_default: default.then_some(true),
        seeded: true,
        relays: relays
            .iter()
            .map(|(url, label)| relay_with_label(url, label, now))
            .collect(),
        updated_at: now,
    }
}

fn relay_with_label(url: &str, label: &str, now: u64) -> RelayRecord {
    RelayRecord {
        url: url.to_owned(),
        label: label.to_owned(),
        enabled: true,
        read: true,
        write: true,
        state: RelayConnectionState::Idle,
        last_error: None,
        last_connected_at: None,
        updated_at: now,
        health: RelayHealth::default(),
    }
}

fn label_for_url(url: &str) -> String {
    let host = url
        .split("://")
        .nth(1)
        .unwrap_or(url)
        .split('/')
        .next()
        .unwrap_or(url);
    host.strip_prefix("relay.").unwrap_or(host).to_owned()
}
