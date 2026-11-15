#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::event;
use lkjstr_protocol::{NostrFilter, matches_filter};
use std::collections::BTreeSet;
#[test]
fn a_second_relays_missing_event_can_be_inside_the_first_answer_range() {
    let first: Vec<_> = [100, 90, 80]
        .map(|at| event(at, 1, "overlap", vec![]))
        .into();
    let missing = event(95, 1, "only on second relay", vec![]);
    let second: Vec<_> = first.iter().cloned().chain([missing]).collect();
    let full = NostrFilter {
        kinds: Some(vec![1]),
        limit: Some(200),
        ..Default::default()
    };
    let older = NostrFilter {
        until: Some(79),
        ..full.clone()
    };
    let newer = NostrFilter {
        since: Some(101),
        ..full.clone()
    };
    let before: BTreeSet<_> = first
        .iter()
        .chain(&second)
        .filter(|e| matches_filter(e, &full))
        .map(|e| e.id.clone())
        .collect();
    let after: BTreeSet<_> = first
        .iter()
        .chain(
            second
                .iter()
                .filter(|e| matches_filter(e, &older) || matches_filter(e, &newer)),
        )
        .map(|e| e.id.clone())
        .collect();
    assert_eq!(before.len(), 4);
    assert_eq!(after.len(), 3);
    println!("range fallback REQs=2->3 duplicate_events=3->0 recall=4->3 REJECTED");
}
#[test]
fn disjoint_verified_outboxes_can_exceed_a_device_two_cover_budget() {
    let authors: Vec<Vec<_>> = (0..7)
        .map(|i| vec![format!("wss://a{i}.test/"), format!("wss://b{i}.test/")])
        .collect();
    let required: BTreeSet<_> = authors.iter().flatten().collect();
    assert_eq!(required.len(), 14);
    for budget in [6, 12] {
        let admitted: BTreeSet<_> = required.iter().take(budget).copied().collect();
        let complete = authors
            .iter()
            .filter(|routes| routes.iter().all(|r| admitted.contains(r)))
            .count();
        assert!(complete < authors.len());
        println!(
            "two-cover budget={budget} required_connections=14 covered_authors={complete}/7 infeasible_without_reader_fallback"
        );
    }
}
