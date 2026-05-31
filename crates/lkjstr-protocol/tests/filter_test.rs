use std::collections::BTreeMap;

use lkjstr_protocol::{
    NostrEvent, NostrFilter, matches_any_filter, matches_filter, parse_filter_value,
};
use serde_json::json;

#[test]
fn parses_valid_filters() -> Result<(), String> {
    let filter = parse_filter_value(&json!({"kinds": [1], "#t": ["workspace"], "limit": 10}))
        .ok_or_else(|| "filter should parse".to_owned())?;
    assert_eq!(filter.kinds, Some(vec![1]));
    assert_eq!(filter.limit, Some(10));
    assert_eq!(filter.tags.get("t"), Some(&vec!["workspace".to_owned()]));
    Ok(())
}

#[test]
fn rejects_malformed_filters() {
    assert_eq!(parse_filter_value(&json!({"kinds": ["1"]})), None);
    assert_eq!(parse_filter_value(&json!({"ids": ["bad"]})), None);
    assert_eq!(parse_filter_value(&json!({"unknown": true})), None);
    assert_eq!(parse_filter_value(&json!({"#too": ["bad"]})), None);
}

#[test]
fn matches_conditions_inside_filter_with_and_semantics() {
    let event = event();
    let filter = NostrFilter {
        kinds: Some(vec![1]),
        since: Some(50),
        until: Some(100),
        tags: tag_filter("t", "workspace"),
        ..NostrFilter::default()
    };
    assert!(matches_filter(&event, &filter));
    let miss = NostrFilter {
        kinds: Some(vec![0]),
        tags: tag_filter("t", "workspace"),
        ..NostrFilter::default()
    };
    assert!(!matches_filter(&event, &miss));
}

#[test]
fn matches_filter_arrays_with_or_semantics() {
    let event = event();
    let miss = NostrFilter {
        kinds: Some(vec![0]),
        ..NostrFilter::default()
    };
    let hit = NostrFilter {
        authors: Some(vec![event.pubkey.chars().take(8).collect()]),
        ..NostrFilter::default()
    };
    assert!(matches_any_filter(&event, &[miss, hit]));
}

fn event() -> NostrEvent {
    NostrEvent {
        id: hex64('0'),
        pubkey: hex64('1'),
        created_at: 100,
        kind: 1,
        tags: vec![
            vec!["p".to_owned(), hex64('a')],
            vec!["t".to_owned(), "workspace".to_owned()],
        ],
        content: "hello".to_owned(),
        sig: hex128('2'),
    }
}

fn tag_filter(key: &str, value: &str) -> BTreeMap<String, Vec<String>> {
    BTreeMap::from([(key.to_owned(), vec![value.to_owned()])])
}

fn hex64(character: char) -> String {
    std::iter::repeat_n(character, 64).collect()
}

fn hex128(character: char) -> String {
    std::iter::repeat_n(character, 128).collect()
}
