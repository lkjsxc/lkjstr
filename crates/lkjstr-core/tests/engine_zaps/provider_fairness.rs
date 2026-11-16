#![allow(clippy::unwrap_used)]
use super::common;
use common::*;
use lkjstr_core::{engine::zaps::*, store::Store};
use std::collections::BTreeMap;
fn people() -> (Store, Vec<String>) {
    let mut store = Store::new(1000);
    let mut people = vec![];
    for n in 1..=25 {
        profile(&mut store, n, &format!("person{n}@ln.test"), 1);
        people.push(key(n).public_key());
    }
    people.sort();
    (store, people)
}
#[test]
fn repeated_earlier_failures_do_not_starve_a_later_first_attempt() {
    let (store, people) = people();
    let last = people.last().unwrap();
    let mut providers = Providers::default();
    let mut running = providers.sync(&store, &people, 100).unwrap().fetch;
    let mut observed = false;
    for step in 1..=12 {
        let now = 100 + step * 14;
        for job in running {
            if &job.binding.recipient == last {
                observed = true;
                providers.complete(&store, &job, Ok(response(&job.binding, 4)), now);
            } else {
                assert!(providers.complete(&store, &job, Err(Failure::Network), now));
            }
        }
        running = providers.sync(&store, &people, now).unwrap().fetch;
        if observed {
            break;
        }
    }
    assert!(
        observed,
        "a never-attempted provider must precede repeated negative-cache retries"
    );
}
#[test]
fn explicit_quote_takes_the_next_free_slot_without_cancelling_background_work() {
    let (store, people) = people();
    let visible: Vec<_> = people
        .iter()
        .map(|p| Target::Profile { pubkey: p.clone() })
        .collect();
    let urgent = people.last().unwrap().clone();
    let mut state = State::default();
    for _ in 0..7 {
        state.tick(&store, &visible, &BTreeMap::new(), &BTreeMap::new(), 100);
    }
    let work = state.effects();
    assert_eq!(work.providers.len(), 4);
    assert!(work.providers.iter().all(|j| j.binding.recipient != urgent));
    state
        .jobs
        .quote(
            Owner {
                client: 1,
                req: "urgent".into(),
            },
            QuoteInput {
                target: Target::Profile {
                    pubkey: urgent.clone(),
                },
                amount_msat: Some(21000),
            },
            101,
        )
        .unwrap();
    state.tick(&store, &visible, &BTreeMap::new(), &BTreeMap::new(), 101);
    let held = state.effects();
    assert!(held.providers.is_empty() && held.abort_providers.is_empty());
    let first = &work.providers[0];
    assert!(state.provider_response(&store, first, Err(Failure::Network), 114));
    state.tick(&store, &visible, &BTreeMap::new(), &BTreeMap::new(), 114);
    let next = state.effects();
    assert_eq!(next.providers.len(), 1);
    assert_eq!(
        next.providers[0].binding.recipient, urgent,
        "explicit demand must pass background first attempts"
    );
    assert!(next.abort_providers.is_empty());
}
