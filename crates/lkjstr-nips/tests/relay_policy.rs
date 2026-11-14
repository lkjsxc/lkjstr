#![allow(clippy::unwrap_used)]
mod common;
use common::{tag, unsigned};
use lkjstr_nips::relay::{self, RelayUsage};
use std::collections::{BTreeMap, BTreeSet};

#[test]
fn nip65_read_write_defaults_invalid_markers_and_duplicate_merging() {
    let event = unsigned(
        10002,
        vec![
            tag(&["r", "wss://B.example", "read"]),
            tag(&["r", "wss://b.example/", "write"]),
            tag(&["r", "wss://a.example"]),
            tag(&["r", "wss://unknown.example", "typo"]),
            tag(&["r", "javascript:bad"]),
        ],
        "",
    );
    let list = relay::relay_list(&event).unwrap();
    assert_eq!(list.len(), 2);
    assert!(list.iter().all(|r| r.read && r.write));
    let tags = relay::relay_tags(&list).unwrap();
    assert_eq!(relay::relay_list(&unsigned(10002, tags, "")).unwrap(), list);
    assert!(
        relay::relay_tags(&[RelayUsage {
            url: "wss://r.example".into(),
            read: false,
            write: false
        }])
        .is_err()
    );
}
#[test]
fn url_validation_preserves_paths_and_rejects_userinfo_or_fragments() {
    assert_eq!(
        relay::relay_url("wss://EXAMPLE.com:443/path?q=x").unwrap(),
        "wss://example.com/path?q=x"
    );
    for invalid in [
        "https://r.example",
        "wss://user@r.example",
        "wss://r.example/#x",
        "not a URL",
    ] {
        assert!(relay::relay_url(invalid).is_err());
    }
}
#[test]
fn outbox_prefers_coverage_then_scores_and_reports_missing_authors() {
    let authors = BTreeMap::from([
        (
            "a".into(),
            vec!["wss://shared.example".into(), "wss://fast.example".into()],
        ),
        ("b".into(), vec!["wss://shared.example".into()]),
        ("c".into(), vec!["wss://other.example".into()]),
        ("d".into(), vec![]),
    ]);
    let scores = BTreeMap::from([
        ("wss://fast.example".into(), 1.0),
        ("wss://shared.example".into(), 0.8),
    ]);
    let cover = relay::outbox_cover(&authors, &scores, 1);
    assert_eq!(cover.relays, vec!["wss://shared.example/"]);
    assert_eq!(cover.uncovered, BTreeSet::from(["c".into(), "d".into()]));
    assert_eq!(relay::outbox_cover(&authors, &scores, 0).uncovered.len(), 4);
    assert_eq!(
        relay::outbox_cover(&authors, &scores, 100).uncovered,
        BTreeSet::from(["d".into()])
    );
}
#[test]
fn outbox_generated_graphs_obey_budget_deduplication_and_coverage_invariants() {
    for seed in 0u64..100 {
        let mut state = seed + 1;
        let mut authors = BTreeMap::new();
        let mut scores = BTreeMap::new();
        for author in 0..12 {
            let mut relays = vec![];
            for relay in 0..8 {
                state = state.wrapping_mul(6364136223846793005).wrapping_add(1);
                if state >> 62 == 0 {
                    relays.push(format!("wss://r{relay}.example/"));
                }
            }
            authors.insert(format!("a{author}"), relays);
        }
        scores.insert("wss://r0.example/".into(), f64::NAN);
        scores.insert("wss://r1.example/".into(), -10.0);
        let mut previous = authors.len();
        for budget in 0..=8 {
            let cover = relay::outbox_cover(&authors, &scores, budget);
            assert!(cover.relays.len() <= budget);
            assert_eq!(
                cover.relays.iter().collect::<BTreeSet<_>>().len(),
                cover.relays.len()
            );
            assert!(cover.uncovered.len() <= previous);
            previous = cover.uncovered.len();
            for (author, relays) in &authors {
                assert_eq!(
                    cover.uncovered.contains(author),
                    !relays.iter().any(|r| cover.relays.contains(r))
                );
            }
            assert_eq!(relay::outbox_cover(&authors, &scores, budget), cover);
        }
    }
}
