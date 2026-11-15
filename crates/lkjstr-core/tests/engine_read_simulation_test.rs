//! Deterministic workload, not a promise about public relay recall.
#![allow(clippy::expect_used)]
use lkjstr_core::engine::network::read_plan::{Candidate, select, weight};
use std::collections::BTreeSet;

struct Relay {
    candidate: Candidate,
    events: Vec<usize>,
    latency: u64,
    limit: usize,
    useful: u64,
    failures: u32,
}
#[derive(Debug, PartialEq)]
struct Scorecard {
    obtained: usize,
    first_screen_ms: u64,
    connections: usize,
    reqs: usize,
    duplicates: usize,
    bytes: usize,
}
fn score(relays: &[Relay], routes: &[String]) -> Scorecard {
    let mut arrivals = vec![];
    for url in routes {
        let r = relays
            .iter()
            .find(|r| r.candidate.url == *url)
            .expect("route");
        if r.failures == 0 {
            arrivals.extend(r.events.iter().take(r.limit).map(|id| (r.latency, *id)));
        }
    }
    arrivals.sort();
    let mut found = BTreeSet::new();
    let mut screen = u64::MAX;
    let mut duplicates = 0;
    for (time, id) in &arrivals {
        if !found.insert(*id) {
            duplicates += 1;
        }
        if found.len() >= 50 {
            screen = screen.min(*time);
        }
    }
    Scorecard {
        obtained: found.len(),
        first_screen_ms: screen,
        connections: routes.len(),
        reqs: routes.len(),
        duplicates,
        bytes: arrivals.len() * 512,
    }
}
#[test]
fn thirty_two_relays_three_hundred_followed_authors_scorecard() {
    // All 300 followed authors have a two-relay signed-list equivalent. Events
    // are held separately as ground truth; candidates cannot inspect them.
    // Relays 0/1 have historical volume but overlapping stale coverage.
    let relays: Vec<_> = (0usize..32)
        .map(|i| {
            let events = match i {
                0..=2 => (0..200).collect(),
                3 => (100..300).collect(),
                _ => ((i * 7) % 300..((i * 7) % 300 + 40).min(300)).collect(),
            };
            let authors = (0..300)
                .filter(|a| match i {
                    2 => *a < 200,
                    3 => *a >= 100,
                    4 => *a < 100,
                    5 => *a >= 200,
                    _ => false,
                })
                .map(|a| format!("{a:064x}"))
                .collect();
            let latency = if i < 2 {
                1200
            } else {
                100 + (i.saturating_sub(3) as u64) * 70
            };
            let useful = if i < 2 { 600 } else { 120 };
            let failures = if i % 7 == 6 { 2 } else { 0 };
            Relay {
                candidate: Candidate {
                    url: format!("wss://r{i:02}.test/"),
                    weight: weight(
                        useful,
                        if i < 2 { 4000 } else { 150 },
                        Some(latency),
                        failures,
                        failures > 0,
                        false,
                    ),
                    authors,
                },
                events,
                latency,
                limit: if i < 4 { 200 } else { 40 },
                useful,
                failures,
            }
        })
        .collect();
    let mut old: Vec<_> = relays.iter().collect();
    old.sort_by_key(|r| {
        (
            std::cmp::Reverse(r.useful.saturating_sub(u64::from(r.failures))),
            &r.candidate.url,
        )
    });
    let before = score(
        &relays,
        &old.iter()
            .take(2)
            .map(|r| r.candidate.url.clone())
            .collect::<Vec<_>>(),
    );
    let after = score(
        &relays,
        &select(
            &relays
                .iter()
                .map(|r| r.candidate.clone())
                .collect::<Vec<_>>(),
            2,
        ),
    );
    assert_eq!(
        before,
        Scorecard {
            obtained: 200,
            first_screen_ms: 1200,
            connections: 2,
            reqs: 2,
            duplicates: 200,
            bytes: 204800
        }
    );
    assert_eq!(
        after,
        Scorecard {
            obtained: 300,
            first_screen_ms: 100,
            connections: 2,
            reqs: 2,
            duplicates: 100,
            bytes: 204800
        }
    );
    println!("read scorecard ground_truth=300 before={before:?} after={after:?}");
}
