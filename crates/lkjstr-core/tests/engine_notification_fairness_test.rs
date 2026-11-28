//! Saved-account live heads must leave a bounded turn for initial account discovery.
#![allow(clippy::expect_used)]
mod engine_read_union_support;
use engine_read_union_support::{NOW, R, event, frames};
use lkjstr_core::engine::Engine;
use serde_json::json;
use std::collections::{BTreeMap, BTreeSet};

const OWN_KINDS: [u64; 6] = [0, 3, 10000, 10001, 10002, 10063];

#[test]
fn notification_watches_leave_initial_account_discovery_a_turn_on_one_slot() {
    for accounts in [12_u8, 32] {
        let owners: Vec<_> = (1..=accounts)
            .map(|person| event(person, 1, 1, vec![]).pubkey)
            .collect();
        let expected: BTreeSet<_> = owners
            .iter()
            .flat_map(|account| OWN_KINDS.map(|kind| (account.clone(), kind)))
            .collect();
        let mut e = Engine::new();
        e.network.configure(vec![R.into()], NOW);
        e.network.relay_information(
            R,
            &json!({"limitation":{
                "max_subscriptions":1,"max_filters":1,"max_limit":1
            }})
            .to_string(),
        );
        e.discover_accounts(owners.clone(), vec![], NOW);
        e.network.connected(R, NOW + 1);

        let mut discovered = BTreeSet::new();
        let mut watched = BTreeSet::new();
        let mut live_wires = BTreeSet::new();
        let mut last_watch = BTreeMap::new();
        let mut all_at = None;
        let mut requests = 0;
        for elapsed in (1..=60_001).step_by(100) {
            let mut sent_this_turn = 0;
            for frame in frames(&mut e.network) {
                if frame[0] == "CLOSE" {
                    live_wires.remove(frame[1].as_str().expect("closed wire"));
                    continue;
                }
                if frame[0] != "REQ" {
                    continue;
                }
                requests += 1;
                sent_this_turn += 1;
                let wire = frame[1].as_str().expect("wire").to_owned();
                live_wires.insert(wire);
                assert_eq!(live_wires.len(), 1, "one physical subscription at a time");
                assert_eq!(frame.as_array().expect("REQ").len(), 3);
                let filter = &frame[2];
                assert_eq!(filter["limit"], 1, "retain the relay's one-result limit");
                if let Some(people) = filter["#p"].as_array() {
                    assert_eq!(people.len(), 1);
                    let account = people[0].as_str().expect("notification account").to_owned();
                    assert!(owners.contains(&account));
                    assert!(
                        filter["kinds"]
                            .as_array()
                            .expect("notification kinds")
                            .contains(&json!(7))
                    );
                    watched.insert(account.clone());
                    if let Some(previous) = last_watch.insert(account, elapsed) {
                        assert!(
                            elapsed - previous >= 1000,
                            "settled notification rotation must keep its cooldown"
                        );
                    }
                } else {
                    let authors = filter["authors"].as_array().expect("discovery authors");
                    assert_eq!(authors.len(), 1);
                    let account = authors[0].as_str().expect("discovery account").to_owned();
                    let kinds = filter["kinds"].as_array().expect("discovery kinds");
                    assert_eq!(kinds.len(), 1);
                    let kind = kinds[0].as_u64().expect("discovery kind");
                    assert!(expected.contains(&(account.clone(), kind)));
                    discovered.insert((account, kind));
                }
                // Every relay answer is prompt. Any starvation is scheduler policy,
                // not a timeout, verification backlog or an unavailable provider.
                e.network
                    .message(R, &json!(["EOSE", frame[1]]).to_string(), NOW + elapsed + 1);
            }
            assert!(
                sent_this_turn <= 1,
                "retain the 100 ms relay request spacing"
            );
            if discovered == expected {
                all_at.get_or_insert(elapsed);
            }
            if elapsed < 60_001 {
                e.tick(NOW + elapsed + 100);
            }
        }
        eprintln!(
            "saved accounts={accounts}: discovery={}/{} all_at={all_at:?} ms; REQs={requests}/60s",
            discovered.len(),
            expected.len(),
        );
        assert_eq!(watched.len(), usize::from(accounts));
        assert_eq!(
            discovered, expected,
            "every account record must receive a turn"
        );
        assert!(
            all_at.is_some_and(|at| at <= (u64::from(accounts) * 7 + 10) * 100),
            "initial heads and six per-account records must complete in bounded turns"
        );
        assert!(
            requests <= 601,
            "the shared relay request budget must remain bounded"
        );
    }
}
