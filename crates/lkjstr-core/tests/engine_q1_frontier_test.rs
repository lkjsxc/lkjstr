#![allow(clippy::expect_used)]
mod engine_q1_frontier_support;
use engine_q1_frontier_support::{Fixture, NOW, RELAY, frames};
use lkjstr_protocol::{NostrFilter, matches_filter, parse_filter_value};
use serde_json::json;

#[test]
fn older_sibling_results_do_not_skip_an_unreceived_intermediate_event() {
    for order in [[0, 1, 3], [3, 1, 0]] {
        let mut fixture = Fixture::new();
        let initial = fixture.initial[1].clone();
        for index in order {
            fixture.receive(&initial, index, NOW + 10);
        }
        // The narrow sibling's old result reaches the shared store immediately.
        assert!(fixture.store.get(&fixture.events[3].id).is_some());
        assert!(fixture.store.get(&fixture.events[2].id).is_none());
        fixture.finish(&initial, NOW + 20);
        let cursor = fixture.network.page_cursor(&fixture.broad);
        let next = NostrFilter {
            until: cursor,
            ..fixture.broad.clone()
        };
        fixture.plan(next, true, NOW + 200);
        let request = frames(&mut fixture.network)
            .into_iter()
            .find(|frame| frame[0] == "REQ")
            .expect("continuation");
        let filter = parse_filter_value(&request[2]).expect("continuation filter");
        // Emulate the relay's latest-L answer to the actual transmitted filter.
        let mut matches: Vec<_> = fixture
            .events
            .iter()
            .enumerate()
            .filter(|(_, event)| matches_filter(event, &filter))
            .map(|(index, event)| (index, event.created_at, event.id.clone()))
            .collect();
        matches.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.2.cmp(&b.2)));
        matches.truncate(filter.limit.expect("bounded page") as usize);
        for (index, _, _) in matches {
            fixture.receive(&request[1], index, NOW + 210);
        }
        fixture.finish(&request[1], NOW + 220);
        assert!(
            fixture.store.get(&fixture.events[2].id).is_some(),
            "an older sibling answer must not skip the broad filter's unseen event at 90"
        );
        assert_eq!(cursor, Some(99));
        assert_eq!(filter.until, Some(99));
        assert_eq!(filter.limit, Some(2));
    }
}

#[test]
fn duplicates_keep_the_saturated_page_at_its_own_quota() {
    let mut fixture = Fixture::new();
    let wire = fixture.initial[1].clone();
    for index in [0, 0, 3, 3, 1, 3] {
        fixture.receive(&wire, index, NOW + 10);
    }
    fixture.finish(&wire, NOW + 20);
    assert_eq!(fixture.network.page_cursor(&fixture.broad), Some(99));
    assert_eq!(fixture.network.page_cursor(&fixture.narrow), Some(1));
    assert!(!fixture.network.page_exhausted(&fixture.broad));
    let stats = fixture.network.request_stats();
    assert!(
        stats
            .as_array()
            .expect("logical requests")
            .iter()
            .all(|request| request["received"] == 2)
    );
}

#[test]
fn removing_a_finite_sibling_keeps_the_owned_wire_and_its_frontier() {
    let mut fixture = Fixture::new();
    let wire = fixture.initial[1].clone();
    fixture.receive(&wire, 0, NOW + 10);
    fixture.receive(&wire, 1, NOW + 11);
    fixture.plan(fixture.broad.clone(), false, NOW + 20);
    assert!(
        !frames(&mut fixture.network)
            .iter()
            .any(|frame| frame[0] == "REQ" || frame[0] == "CLOSE")
    );
    assert_eq!(fixture.network.open_wires().get(RELAY), Some(&1));
    // This was selected by the removed sibling, but still matches the broad
    // filter in the immutable finite wire envelope.
    fixture.receive(&wire, 3, NOW + 30);
    fixture.finish(&wire, NOW + 31);
    assert_eq!(fixture.network.page_cursor(&fixture.broad), Some(99));
    assert!(fixture.network.open_wires().is_empty());
}

#[test]
fn rejected_envelope_does_not_prove_a_page_and_retries_without_old_frontiers() {
    let mut fixture = Fixture::new();
    let wire = fixture.initial[1].clone();
    for index in [0, 1, 3] {
        fixture.receive(&wire, index, NOW + 10);
    }
    fixture.network.message(
        RELAY,
        &json!(["CLOSED", wire, "error: filters rejected"]).to_string(),
        NOW + 20,
    );
    assert_eq!(fixture.network.page_cursor(&fixture.broad), None);
    fixture.network.tick(NOW + 200);
    let retry = frames(&mut fixture.network)
        .into_iter()
        .find(|frame| frame[0] == "REQ")
        .expect("single-filter retry");
    assert_ne!(retry[1], wire);
    assert_eq!(retry.as_array().expect("single filter").len(), 3);
    assert_eq!(retry[2]["until"], 200);
    fixture
        .network
        .message(RELAY, &json!(["EOSE", wire]).to_string(), NOW + 201);
    assert_eq!(fixture.network.page_cursor(&fixture.broad), None);
    let sent = fixture.network.request_stats();
    assert!(
        sent.as_array()
            .expect("requests")
            .iter()
            .filter(|request| request["sent"] == true)
            .all(|request| request["received"] == 0)
    );
}
