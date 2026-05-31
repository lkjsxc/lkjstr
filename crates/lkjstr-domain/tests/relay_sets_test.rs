use lkjstr_domain::{
    RelayPatch, RelayPurpose, add_relay, patch_relay, remove_relay, restore_default_relay_set,
    seed_relay_sets,
};

#[test]
fn seeds_default_user_and_discovery_sets_once() {
    let seeded = seed_relay_sets(&[], 10);
    assert_eq!(seeded[0].id, "public-default");
    assert_eq!(seeded[0].purpose, RelayPurpose::User);
    assert_eq!(seeded[0].relays[0].url, "wss://relay.damus.io");
    assert_eq!(seeded[1].id, "discovery-default");
    assert_eq!(seeded[1].purpose, RelayPurpose::Discovery);
    assert_eq!(seed_relay_sets(&seeded, 20), seeded);
}

#[test]
fn adds_normalized_relays_without_duplicates() -> Result<(), String> {
    let seeded = seed_relay_sets(&[], 10);
    let next = add_relay(&seeded, "public-default", "relay.example/path", 20)
        .map_err(|error| format!("{error:?}"))?;
    let public = next
        .iter()
        .find(|set| set.id == "public-default")
        .ok_or("missing public set")?;
    assert_eq!(public.updated_at, 20);
    assert!(
        public
            .relays
            .iter()
            .any(|relay| relay.url == "wss://relay.example/path")
    );
    let again = add_relay(&next, "public-default", "wss://relay.example/path", 30)
        .map_err(|error| format!("{error:?}"))?;
    assert_eq!(again[0].relays.len(), public.relays.len());
    Ok(())
}

#[test]
fn patches_and_removes_relay_rows() -> Result<(), String> {
    let seeded = seed_relay_sets(&[], 10);
    let next = patch_relay(
        &seeded,
        "public-default",
        "wss://relay.damus.io",
        RelayPatch::Read(false),
        20,
    )
    .map_err(|error| format!("{error:?}"))?;
    assert!(!next[0].relays[0].read);
    let removed = remove_relay(&next, "public-default", "wss://relay.damus.io", 30)
        .map_err(|error| format!("{error:?}"))?;
    assert_ne!(removed[0].relays[0].url, "wss://relay.damus.io");
    Ok(())
}

#[test]
fn restores_one_purpose_default_set() -> Result<(), String> {
    let seeded = seed_relay_sets(&[], 10);
    let removed = remove_relay(&seeded, "discovery-default", "wss://purplepag.es/", 20)
        .map_err(|error| format!("{error:?}"))?;
    let restored = restore_default_relay_set(&removed, RelayPurpose::Discovery, 30);
    let discovery = restored
        .iter()
        .find(|set| set.id == "discovery-default")
        .ok_or("discovery default")?;
    assert!(
        discovery
            .relays
            .iter()
            .any(|relay| relay.url == "wss://purplepag.es/")
    );
    assert_eq!(discovery.updated_at, 30);
    Ok(())
}
