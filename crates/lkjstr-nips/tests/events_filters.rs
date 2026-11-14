#![allow(clippy::unwrap_used)]
mod common;
use common::{event, key, tag, unsigned};
use lkjstr_nips::{
    Error,
    event::Event,
    filter::{self, Filter},
    hex,
};
use serde_json::json;
use sha2::{Digest, Sha256};

#[test]
fn illustrative_nip27_event_has_an_invalid_id_and_is_rejected() {
    let fixture = include_str!("vectors/nip27-0.json");
    assert_eq!(Event::parse(fixture, 4096), Err(Error::EventId));
    let event = event(1, vec![], "roundtrip");
    event.verify().unwrap();
    assert_eq!(
        Event::parse(&event.to_json().unwrap(), 4096).unwrap(),
        event
    );
}
#[test]
fn canonical_serialization_unicode_control_escaping_and_hash() {
    let event = unsigned(
        1,
        vec![tag(&["t", "雪"])],
        "hi\n\"\\\r\t\u{8}\u{c}\u{0}雪/\u{2028}",
    );
    let expected = format!(
        "[0,\"{}\",1700000000,1,[[\"t\",\"雪\"]],\"hi\\n\\\"\\\\\\r\\t\\b\\f\\u0000雪/\u{2028}\"]",
        key(1).public_key()
    );
    assert_eq!(event.canonical().unwrap(), expected);
    assert_eq!(
        hex(&event.id_bytes().unwrap()),
        hex(&Sha256::digest(expected.as_bytes()))
    );
}
#[test]
fn mutation_id_signature_key_shape_and_json_limits_rejected() {
    let original = event(1, vec![], "hello");
    let mut changed = original.clone();
    changed.data.content.push('!');
    assert_eq!(changed.verify(), Err(Error::EventId));
    let mut changed = original.clone();
    changed.sig = "00".repeat(64);
    assert!(changed.verify().is_err());
    let mut changed = original.clone();
    changed.id = changed.id.to_uppercase();
    assert!(changed.verify().is_err());
    assert!(unsigned(1, vec![vec![]], "").canonical().is_err());
    assert!(unsigned(1, vec![], "").sign(&key(2), &[0; 32]).is_err());
    assert_eq!(
        Event::parse(&original.to_json().unwrap(), 1),
        Err(Error::Size)
    );
    let mut bad = serde_json::to_value(&original).unwrap();
    bad["kind"] = json!(65536);
    assert!(serde_json::from_value::<Event>(bad).is_err());
}
#[test]
fn filters_and_or_empty_lists_inclusive_times_exact_ids_and_first_tag_value() {
    let e = event(
        1,
        vec![tag(&["t", "rust", "wasm"]), tag(&["t", "nostr"])],
        "hello",
    );
    for (query, expected) in [
        (json!({}), true),
        (json!({"kinds":[]}), false),
        (json!({"ids":[]}), false),
        (json!({"authors":[]}), false),
        (json!({"#t":[]}), false),
        (json!({"#t":["other", "rust"]}), true),
        (json!({"#t":["wasm"]}), false),
        (
            json!({"since":e.data.created_at,"until":e.data.created_at}),
            true,
        ),
        (json!({"since":e.data.created_at+1}), false),
        (json!({"until":e.data.created_at-1}), false),
        (
            json!({"ids":[e.id], "authors":[e.data.pubkey], "kinds":[1], "#t":["nostr"], "limit":0}),
            true,
        ),
        (json!({"kinds":[1], "#t":["missing"]}), false),
    ] {
        let filter: Filter = serde_json::from_value(query).unwrap();
        assert_eq!(filter.matches(&e).unwrap(), expected);
    }
    let filter: Filter = serde_json::from_value(json!({"ids":[&e.id[..8]]})).unwrap();
    assert!(filter.matches(&e).is_err());
    assert!(!filter::matches_any(&[], &e).unwrap());
    assert!(filter::matches_any(&[Filter::default()], &e).unwrap());
}
#[test]
fn indexed_tags_are_case_sensitive_and_search_policy_is_explicit() {
    let e = event(1, vec![tag(&["T", "Nostr"])], "hello Rust");
    let filter: Filter = serde_json::from_value(json!({"#T":["Nostr"]})).unwrap();
    assert!(filter.matches(&e).unwrap());
    for key in ["#tt", "#é", "#1", "unknown"] {
        let f: Filter = serde_json::from_value(json!({key:["x"]})).unwrap();
        assert!(f.validate().is_err());
    }
    let f: Filter = serde_json::from_value(json!({"search":"Rust", "kinds":[1]})).unwrap();
    assert_eq!(f.matches(&e), Err(Error::SearchPolicy));
    assert!(
        f.matches_with_search(&e, |query, e| e.data.content.contains(query))
            .unwrap()
    );
    assert_eq!(
        serde_json::to_value(f).unwrap(),
        json!({"search":"Rust", "kinds":[1]})
    );
}
