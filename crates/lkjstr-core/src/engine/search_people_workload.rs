use super::policy;
use crate::store::Store;
use lkjstr_nips::{event::UnsignedEvent, keys::SecretKey};
use serde_json::json;
use std::time::Instant;

type Result = std::result::Result<(), Box<dyn std::error::Error>>;
#[test]
#[ignore = "manual bounded selector workload; records time without a host-dependent threshold"]
fn retained_directory_selection_workload() -> Result {
    let mut store = Store::new(4000);
    for i in 1u32..=2000 {
        let mut bytes = [0u8; 32];
        bytes[28..].copy_from_slice(&i.to_be_bytes());
        let key = SecretKey::from_bytes(bytes)?;
        let content = json!({
            "name":format!("alice-{i:04}"),
            "display_name":format!("Blue directory person {i:04}"),
            "nip05":format!("person-{i}@fixture.test")
        })
        .to_string();
        let event =
            UnsignedEvent::new(key.public_key(), 100, 0, vec![], content).sign(&key, &[0; 32])?;
        let parsed = lkjstr_protocol::parse_nostr_event_json(&event.to_json()?, None)
            .map_err(|_| "invalid signed profile fixture")?;
        store.insert(parsed, None);
    }
    let private = Default::default();
    let start = Instant::now();
    for _ in 0..25 {
        let people = policy::select(&store, &private, None, "alice blue");
        assert_eq!(people.len(), 6);
    }
    println!(
        "retained_directory profiles=2000 uncached_selections=25 elapsed_us={}",
        start.elapsed().as_micros()
    );
    Ok(())
}
