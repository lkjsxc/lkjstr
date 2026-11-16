#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::*;
use lkjstr_core::engine::{
    network::{Effect, Network},
    protocol::Query,
};
use lkjstr_protocol::NostrFilter;
use serde_json::{Value, json};
// Scheduler milliseconds are later than the fixture's signed event seconds.
const BASE_MS: u64 = 200_000;

fn requests(n: &mut Network) -> Vec<Value> {
    n.drain_effects()
        .into_iter()
        .filter_map(|f| match f {
            Effect::Send(_, text) => {
                let v: Value = serde_json::from_str(&text).expect("frame");
                (v[0] == "REQ").then_some(v)
            }
            _ => None,
        })
        .collect()
}
fn setup(until: Option<u64>) -> (Network, NostrFilter, Value) {
    let mut n = Network::default();
    n.configure(vec![RELAY.into()], BASE_MS);
    n.relay_information(
        RELAY,
        r#"{"limitation":{"max_subscriptions":1,"max_limit":3}}"#,
    );
    let filter = NostrFilter {
        kinds: Some(vec![1, 6]),
        since: Some(5),
        until,
        limit: Some(200),
        ..Default::default()
    };
    n.plan(
        vec![("feed".into(), filter.clone(), Query::default())],
        &lkjstr_core::store::Store::new(0),
        BASE_MS,
    );
    n.connected(RELAY, BASE_MS + 10);
    let head = requests(&mut n).remove(0);
    (n, filter, head)
}
fn note(n: &mut Network, req: &Value, at: u64) {
    let event = event(at, 1, "page", vec![]);
    let received = n
        .message(
            RELAY,
            &json!(["EVENT", req[1], event]).to_string(),
            BASE_MS + 20,
        )
        .expect("accepted event");
    n.event(RELAY, &received, BASE_MS + 20);
}
fn eose(n: &mut Network, req: &Value, now: u64) {
    n.message(RELAY, &json!(["EOSE", req[1]]).to_string(), BASE_MS + now);
}
fn preempt(n: &mut Network, filter: &NostrFilter, head: &Value) {
    let profile = NostrFilter {
        kinds: Some(vec![0]),
        authors: Some(vec!["a".repeat(64)]),
        ..Default::default()
    };
    n.plan(
        vec![
            ("feed".into(), filter.clone(), Query::default()),
            ("profile".into(), profile, Query::default()),
        ],
        &lkjstr_core::store::Store::new(0),
        BASE_MS + 30,
    );
    n.tick(BASE_MS + 105);
    let lookup = requests(n).remove(0);
    assert_eq!(lookup[2]["kinds"], json!([0]));
    // A late response from the closed feed must not finish its page.
    eose(n, head, 106);
    eose(n, &lookup, 107);
}
#[test]
fn interrupted_pages_replay_original_filters_before_claiming_exhaustion() {
    for until in [None, Some(100)] {
        let (mut n, filter, head) = setup(until);
        note(&mut n, &head, 100);
        preempt(&mut n, &filter, &head);
        assert!(!n.page_finished(&filter));
        assert!(!n.page_exhausted(&filter));
        n.tick(BASE_MS + 110);
        let resumed = requests(&mut n).remove(0);
        assert_eq!(resumed[2], head[2]);
        for at in [100, 90, 80] {
            note(&mut n, &resumed, at);
        }
        eose(&mut n, &resumed, 120);
        assert!(n.page_finished(&filter));
        assert!(!n.page_exhausted(&filter));
        assert_eq!(n.page_cursor(&filter), Some(80));
    }
}
#[test]
fn completed_full_head_retains_coverage_across_short_live_resumption() {
    let (mut n, filter, head) = setup(None);
    for at in [100, 90, 80] {
        note(&mut n, &head, at);
    }
    eose(&mut n, &head, 25);
    // Live arrivals do not move the historical page's cursor.
    note(&mut n, &head, 101);
    preempt(&mut n, &filter, &head);
    assert!(n.page_finished(&filter));
    assert_eq!(n.page_cursor(&filter), Some(80));
    n.tick(BASE_MS + 110);
    let resumed = requests(&mut n).remove(0);
    assert_eq!(resumed[2]["since"], 99);
    note(&mut n, &resumed, 102);
    eose(&mut n, &resumed, 120);
    assert!(n.page_finished(&filter));
    assert!(!n.page_exhausted(&filter));
    assert_eq!(n.page_cursor(&filter), Some(80));
}
#[test]
fn completed_short_head_stays_exhausted_despite_live_arrivals() {
    let (mut n, filter, head) = setup(None);
    note(&mut n, &head, 100);
    eose(&mut n, &head, 25);
    for at in [101, 102, 103] {
        note(&mut n, &head, at);
    }
    preempt(&mut n, &filter, &head);
    n.tick(BASE_MS + 110);
    let resumed = requests(&mut n).remove(0);
    eose(&mut n, &resumed, 120);
    assert!(n.page_exhausted(&filter));
    assert_eq!(n.page_cursor(&filter), None);
}

#[test]
fn scrolling_after_preemption_still_requests_older_notes() {
    use lkjstr_core::engine::{Engine, protocol::Input};
    for completed in [false, true] {
        let (mut n, filter, head) = setup(None);
        let mut e = Engine::new();
        e.signed_out_global_filter = false;
        let mut query = Query::default();
        query.filters.since = Some(5);
        open(&mut e, query);
        let mut oldest = String::new();
        let mut notes = Vec::new();
        for at in [100, 90, 80] {
            let event = event(at, 1, "page", vec![]);
            oldest = event.id.clone();
            n.message(
                RELAY,
                &json!(["EVENT", head[1], event]).to_string(),
                BASE_MS + 20,
            );
            n.event(RELAY, &event, BASE_MS + 20);
            notes.push(event.clone());
            e.store.insert(event, None);
        }
        if completed {
            eose(&mut n, &head, 25);
        }
        preempt(&mut n, &filter, &head);
        n.tick(BASE_MS + 110);
        let resumed = requests(&mut n).remove(0);
        if !completed {
            for event in notes {
                n.message(
                    RELAY,
                    &json!(["EVENT", resumed[1], event]).to_string(),
                    BASE_MS + 115,
                );
            }
        }
        eose(&mut n, &resumed, 120);
        n.relays.get_mut(RELAY).expect("relay").max_reqs = 4;
        e.network = n;
        e.input(
            Input::Window {
                sub: "feed".into(),
                anchor: Some(oldest),
                before: 0,
                after: 50,
            },
            BASE_MS + 210,
        );
        e.network.tick(BASE_MS + 310);
        assert!(requests(&mut e.network).iter().any(|f| f[2]["until"] == 80));
    }
}

#[test]
fn disconnected_unfinished_head_replays_filters_instead_of_live_tail() {
    let (mut n, filter, head) = setup(None);
    note(&mut n, &head, 100);
    n.disconnected(RELAY, BASE_MS + 30);
    n.connected(RELAY, BASE_MS + 110);
    let replay = requests(&mut n).remove(0);
    assert_eq!(replay[2], head[2]);
    assert!(!n.page_finished(&filter));
    for at in [100, 90, 80] {
        note(&mut n, &replay, at);
    }
    eose(&mut n, &replay, 120);
    assert!(!n.page_exhausted(&filter));
    assert_eq!(n.page_cursor(&filter), Some(80));
}

#[test]
fn repeated_live_reconnections_preserve_historical_coverage_and_cursor() {
    let (mut n, filter, head) = setup(None);
    for at in [100, 90, 80] {
        note(&mut n, &head, at);
    }
    eose(&mut n, &head, 25);
    for (now, at) in [(200, 101), (400, 102)] {
        n.disconnected(RELAY, BASE_MS + now);
        assert!(n.page_finished(&filter));
        n.connected(RELAY, BASE_MS + now + 110);
        let replay = requests(&mut n).remove(0);
        assert_eq!(replay[2]["since"], at - 3);
        // A short live response is not evidence that historical notes ran out.
        note(&mut n, &replay, at);
        eose(&mut n, &replay, now + 120);
        assert!(n.page_finished(&filter));
        assert!(!n.page_exhausted(&filter));
        assert_eq!(n.page_cursor(&filter), Some(80));
    }
}
