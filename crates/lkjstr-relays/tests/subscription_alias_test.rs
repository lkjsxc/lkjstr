use lkjstr_relays::{
    RelaySubscriptionAliases, compact_relay_subscription_id, relay_subscription_hash,
    relay_subscription_id_valid,
};

#[test]
fn hash_is_stable_lowercase_hex_prefix() {
    assert_eq!(relay_subscription_hash("hello", 12), "2cf24dba5fb0");
}

#[test]
fn compact_subscription_id_preserves_short_ids_and_hashes_long_ids() {
    assert_eq!(
        compact_relay_subscription_id("home", "live", None),
        "home:live"
    );

    let compact = compact_relay_subscription_id(
        "very-long-prefix-name",
        "very-long-topic-name",
        Some("cursor"),
    );
    assert!(relay_subscription_id_valid(&compact));
    assert!(compact.starts_with("very-lon:very-long-"));
}

#[test]
fn aliases_map_logical_ids_to_wire_ids_and_back() {
    let mut aliases = RelaySubscriptionAliases::new();

    let wire = aliases.wire_id("logical-sub", 8);

    assert_eq!(wire.len(), 8);
    assert_eq!(aliases.logical_id(&wire), "logical-sub");
    aliases.forget("logical-sub");
    assert_eq!(aliases.logical_id(&wire), wire);
}
