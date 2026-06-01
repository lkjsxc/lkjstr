use lkjstr_protocol::NostrFilter;
use lkjstr_relays::{
    FeedCursorPoint, PageReadDirection, PageReadIntent, PageReadPhase, PageReadPurpose,
    PageReadSurface, ReadDedupeOptions, RelayReadRequest, RelayRouteGroup, page_read_bounds,
    page_read_semantic_key, read_dedupe_key, route_group_fingerprint,
};

#[test]
fn semantic_key_dedupes_across_owners() {
    let key_a = page_read_semantic_key(&PageReadIntent {
        owner: "tab-a".to_owned(),
        ..intent()
    });
    let key_b = page_read_semantic_key(&PageReadIntent {
        owner: "tab-b".to_owned(),
        ..intent()
    });

    assert_eq!(key_a, key_b);
}

#[test]
fn route_fingerprint_changes_semantic_key() {
    let author = "c".repeat(64);
    let selected = route_group_fingerprint(&[RelayRouteGroup {
        key: "fallback:0".to_owned(),
        relays: vec!["wss://selected/".to_owned()],
        authors: vec![author.clone()],
        source: "fallback".to_owned(),
    }]);
    let routed = route_group_fingerprint(&[RelayRouteGroup {
        key: format!("author:{author}"),
        relays: vec!["wss://route/".to_owned()],
        authors: vec![author],
        source: "nip65".to_owned(),
    }]);

    assert_ne!(
        page_read_semantic_key(&PageReadIntent {
            route_fingerprint: Some(selected),
            ..intent()
        }),
        page_read_semantic_key(&PageReadIntent {
            route_fingerprint: Some(routed),
            ..intent()
        })
    );
}

#[test]
fn bounds_follow_direction_and_explicit_bounds_win() {
    let cursor = FeedCursorPoint {
        created_at: 1_700_000_000,
        id: "a".repeat(64),
    };
    let older = page_read_bounds(&PageReadIntent {
        direction: PageReadDirection::Older,
        cursor: Some(cursor.clone()),
        ..intent()
    });
    let newer = page_read_bounds(&PageReadIntent {
        direction: PageReadDirection::Newer,
        cursor: Some(cursor.clone()),
        ..intent()
    });
    let explicit = page_read_bounds(&PageReadIntent {
        direction: PageReadDirection::Older,
        cursor: Some(cursor.clone()),
        after: Some(cursor.clone()),
        ..intent()
    });

    assert_eq!(older.before, Some(cursor.clone()));
    assert_eq!(newer.after, Some(cursor.clone()));
    assert_eq!(explicit.after, Some(cursor));
}

#[test]
fn surface_and_filters_isolate_semantic_keys() {
    let home = page_read_semantic_key(&intent());
    let profile = page_read_semantic_key(&PageReadIntent {
        surface: PageReadSurface::Profile,
        route_fingerprint: Some("profile-routes".to_owned()),
        ..intent()
    });
    let filtered = page_read_semantic_key(&PageReadIntent {
        relay_filters: vec![NostrFilter {
            authors: Some(vec!["b".repeat(64), "a".repeat(64)]),
            ..NostrFilter::default()
        }],
        ..intent()
    });

    assert_ne!(home, profile);
    assert_ne!(home, filtered);
}

#[test]
fn read_dedupe_key_normalizes_relay_and_filter_order() {
    let left = RelayReadRequest {
        key: "same-page".to_owned(),
        relays: vec!["wss://b/".to_owned(), "wss://a/".to_owned()],
        filters: vec![filter(vec![2, 1])],
        purpose: PageReadPurpose::Feed,
    };
    let right = RelayReadRequest {
        relays: vec!["wss://a/".to_owned(), "wss://b/".to_owned()],
        filters: vec![filter(vec![1, 2])],
        ..left.clone()
    };

    assert_eq!(
        read_dedupe_key(&left, ReadDedupeOptions::default()),
        read_dedupe_key(&right, ReadDedupeOptions::default())
    );
}

#[test]
fn read_dedupe_key_includes_effective_options() {
    let request = RelayReadRequest {
        key: "same-page".to_owned(),
        relays: vec!["wss://a/".to_owned()],
        filters: vec![filter(vec![1])],
        purpose: PageReadPurpose::Feed,
    };

    assert_ne!(
        read_dedupe_key(&request, ReadDedupeOptions::default()),
        read_dedupe_key(
            &request,
            ReadDedupeOptions {
                timeout_ms: Some(10),
                max_events: None,
            }
        )
    );
}

fn intent() -> PageReadIntent {
    PageReadIntent {
        surface: PageReadSurface::Home,
        owner: "tab".to_owned(),
        phase: PageReadPhase::Page,
        selected_relays: vec!["wss://a/".to_owned(), "wss://b/".to_owned()],
        authors: vec!["c".repeat(64)],
        page_size: 30,
        direction: PageReadDirection::Older,
        cursor: Some(FeedCursorPoint {
            created_at: 1_700_000_000,
            id: "abc".to_owned(),
        }),
        before: None,
        after: None,
        purpose: PageReadPurpose::Feed,
        relay_filters: Vec::new(),
        route_fingerprint: None,
    }
}

fn filter(kinds: Vec<u64>) -> NostrFilter {
    NostrFilter {
        kinds: Some(kinds),
        ..NostrFilter::default()
    }
}
