#![allow(clippy::expect_used)]
use lkjstr_core::engine::network::Network;
use serde_json::json;

#[test]
fn route_receipts_evict_oldest_attempts_and_preserve_fifo_across_reload() {
    // Deliberately descending IDs: lexical eviction would discard newest posts.
    let ordered = (0..2050)
        .rev()
        .map(|n| (format!("{n:064x}"), vec![format!("wss://r-{n}.test/")]))
        .collect::<Vec<_>>();
    let mut network = Network::default();
    network.restore_publication_routes(&serde_json::to_string(&ordered).expect("fixture"));
    assert!(
        network
            .published_routes(&format!("{:064x}", 2049))
            .is_empty()
    );
    assert!(
        network
            .published_routes(&format!("{:064x}", 2048))
            .is_empty()
    );
    assert_eq!(
        network.published_routes(&format!("{:064x}", 0)),
        vec!["wss://r-0.test/"]
    );
    let saved = network.publication_routes_json();
    let receipts: Vec<(String, Vec<String>)> = serde_json::from_str(&saved).expect("receipts");
    assert_eq!(receipts.len(), 2048);
    assert_eq!(
        receipts.first().expect("oldest").0,
        format!("{:064x}", 2047)
    );
    assert_eq!(receipts.last().expect("newest").0, format!("{:064x}", 0));
    let mut restored = Network::default();
    restored.restore_publication_routes(&saved);
    assert_eq!(restored.publication_routes_json(), saved);
    // Repeated attempts move one receipt to the back without growing the bound.
    let mut repeated = receipts;
    repeated.push((format!("{:064x}", 2047), vec!["wss://retry.test/".into()]));
    restored.restore_publication_routes(&serde_json::to_string(&repeated).expect("retry"));
    let saved: Vec<(String, Vec<String>)> =
        serde_json::from_str(&restored.publication_routes_json()).expect("retained receipts");
    assert_eq!(saved.len(), 2048);
    assert_eq!(saved.last().expect("newest").0, format!("{:064x}", 2047));
}

#[test]
fn malformed_or_legacy_receipts_start_clean_and_urls_are_validated() {
    let id = "a".repeat(64);
    let valid = json!([[
        id,
        [
            "wss://valid.test",
            "https://invalid.test",
            "wss://u:p@secret.test"
        ]
    ]]);
    let mut network = Network::default();
    network.restore_publication_routes(&valid.to_string());
    assert_eq!(network.published_routes(&id), vec!["wss://valid.test/"]);
    network.restore_publication_routes("not-json");
    assert!(network.published_routes(&id).is_empty());
    network.restore_publication_routes(&json!({id.clone(): ["wss://old.test/"]}).to_string());
    assert!(network.published_routes(&id).is_empty());
}

#[test]
fn route_payload_cap_evicts_fifo_and_keeps_serialized_receipts_reloadable() {
    let routes = (0..64)
        .map(|n| {
            let prefix = format!("wss://r-{n}.test/");
            format!("{prefix}{}", "a".repeat(2048 - prefix.len()))
        })
        .collect::<Vec<_>>();
    let attempts = (0..34)
        .rev()
        .map(|n| (format!("{n:064x}"), routes.clone()))
        .collect::<Vec<_>>();
    let raw = serde_json::to_string(&attempts).expect("attempts");
    let mut network = Network::default();
    network.restore_publication_routes(&raw);
    assert!(network.published_routes(&format!("{:064x}", 33)).is_empty());
    assert!(network.published_routes(&format!("{:064x}", 32)).is_empty());
    assert_eq!(network.published_routes(&format!("{:064x}", 0)).len(), 64);
    let saved = network.publication_routes_json();
    assert!(saved.len() < 8 * 1024 * 1024);
    let receipts: Vec<(String, Vec<String>)> = serde_json::from_str(&saved).expect("receipts");
    assert_eq!(receipts.len(), 32);
    assert_eq!(
        receipts
            .iter()
            .flat_map(|(_, urls)| urls)
            .map(String::len)
            .sum::<usize>(),
        4 * 1024 * 1024
    );
    let mut restored = Network::default();
    restored.restore_publication_routes(&saved);
    assert_eq!(restored.publication_routes_json(), saved);
}
