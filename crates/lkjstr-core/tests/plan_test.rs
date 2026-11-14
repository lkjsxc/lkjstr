use std::collections::HashMap;

use lkjstr_core::plan::{Directory, PlanContext, RelayDefaults, Want, plan};
use lkjstr_core::relays::{RelayStats, Scores, backoff_ms};

struct Book(HashMap<String, Vec<String>>);

impl Directory for Book {
    fn write_relays(&self, pubkey: &str) -> Option<Vec<String>> {
        self.0.get(pubkey).cloned()
    }
    fn read_relays(&self, pubkey: &str) -> Option<Vec<String>> {
        self.0.get(pubkey).cloned()
    }
}

fn url(name: &str) -> String {
    format!("wss://{name}/")
}

fn defaults() -> RelayDefaults {
    RelayDefaults {
        read: vec![url("d1"), url("d2"), url("d3"), url("d4")],
        indexers: vec![url("idx")],
        search: vec![url("s1")],
    }
}

#[test]
fn outbox_routes_authors_and_coalesces_tiles() {
    let book = Book(HashMap::from([
        ("alice".to_owned(), vec![url("a1"), url("shared")]),
        ("bob".to_owned(), vec![url("shared"), url("b1")]),
    ]));
    let scores = Scores::default();
    let defaults = defaults();
    let ctx = PlanContext {
        defaults: &defaults,
        directory: &book,
        scores: &scores,
        now_ms: 0,
    };
    let wants = vec![
        (
            1,
            Want::Notes {
                authors: vec!["alice".into(), "carol".into()],
                until: None,
                limit: 50,
            },
        ),
        (
            2,
            Want::Notes {
                authors: vec!["bob".into()],
                until: None,
                limit: 80,
            },
        ),
    ];
    let planned = plan(&wants, &ctx);
    let shared = planned.iter().find(|p| p.relay == url("shared"));
    let shared = shared.map(|p| (p.filters[0].authors.clone(), p.wants.len(), p.live));
    assert_eq!(
        shared,
        Some((Some(vec!["alice".to_owned(), "bob".to_owned()]), 2, true)),
        "one REQ on the shared relay serves both tiles"
    );
    let carol: Vec<&String> = planned
        .iter()
        .filter(|p| {
            p.filters[0]
                .authors
                .as_ref()
                .is_some_and(|a| a.contains(&"carol".to_owned()))
        })
        .map(|p| &p.relay)
        .collect();
    assert_eq!(
        carol.len(),
        3,
        "unknown authors fall back to default relays"
    );
    assert!(
        planned
            .iter()
            .all(|p| p.filters[0].limit == Some(80) || p.relay != url("shared"))
    );
    let again = plan(&wants, &ctx);
    let keys =
        |list: &[lkjstr_core::plan::Planned]| list.iter().map(|p| p.key()).collect::<Vec<_>>();
    assert_eq!(keys(&planned), keys(&again), "plans are deterministic");
}

#[test]
fn failing_relays_are_avoided_and_one_shots_marked() {
    let book = Book(HashMap::new());
    let mut scores = Scores::default();
    scores.entry(&url("d1")).on_failure(1_000, 0.5);
    let defaults = defaults();
    let ctx = PlanContext {
        defaults: &defaults,
        directory: &book,
        scores: &scores,
        now_ms: 1_500,
    };
    let wants = vec![
        (
            7,
            Want::Events {
                ids: vec!["e".repeat(64)],
                relays: vec![url("hint")],
            },
        ),
        (
            8,
            Want::Profiles {
                pubkeys: vec!["p".repeat(64)],
                contacts: false,
            },
        ),
        (
            9,
            Want::Search {
                query: "rust".into(),
                limit: 20,
            },
        ),
    ];
    let planned = plan(&wants, &ctx);
    assert!(
        planned.iter().all(|p| p.relay != url("d1")),
        "backing-off relay skipped"
    );
    assert!(
        planned.iter().any(|p| p.relay == url("hint")),
        "event hints are used"
    );
    assert!(
        planned.iter().any(|p| p.relay == url("idx")),
        "profiles ask an indexer"
    );
    assert!(
        planned
            .iter()
            .any(|p| p.relay == url("s1") && p.filters[0].search.is_some())
    );
    assert!(planned.iter().all(|p| !p.live));
}

#[test]
fn scores_prefer_fast_reliable_relays_and_backoff_grows() {
    let mut fast = RelayStats::default();
    let mut slow = RelayStats::default();
    for _ in 0..5 {
        fast.reqs += 1;
        fast.on_answer(120.0);
        slow.reqs += 1;
        slow.on_timeout(3_000.0);
    }
    assert!(fast.score(0) > slow.score(0));
    let mut scores = Scores::default();
    *scores.entry(&url("fast")) = fast;
    *scores.entry(&url("slow")) = slow;
    assert_eq!(
        scores.rank(&[url("slow"), url("fast")], 0),
        [url("fast"), url("slow")]
    );
    assert!(backoff_ms(1, 0.0) >= 1_000 && backoff_ms(1, 1.0) <= 2_000);
    assert!(backoff_ms(4, 0.0) > backoff_ms(1, 1.0));
    assert!(backoff_ms(40, 1.0) <= 300_000, "capped");
}

#[test]
fn displayed_targets_and_threads_receive_live_deletions() {
    let defaults = defaults();
    let scores = Scores::default();
    let book = Book(HashMap::new());
    let ctx = PlanContext {
        defaults: &defaults,
        directory: &book,
        scores: &scores,
        now_ms: 0,
    };
    for want in [
        Want::Deletions {
            ids: vec!["target".into()],
            relays: vec![],
        },
        Want::Thread {
            root: "target".into(),
            author: None,
            relays: vec![],
        },
    ] {
        assert!(want.is_live());
        let planned = plan(&[(1, want)], &ctx);
        assert!(!planned.is_empty());
        for request in planned {
            assert!(request.live);
            assert!(request.filters.iter().any(|f| {
                f.kinds.as_ref().is_some_and(|k| k.contains(&5))
                    && f.tags
                        .get("e")
                        .is_some_and(|ids| ids.contains(&"target".into()))
            }));
        }
    }
}
