#![allow(clippy::expect_used)]
use lkjstr_core::{
    engine::{
        accounts::Accounts,
        network::{Effect, Network},
        protocol::{Output, Query, Source},
    },
    store::Store,
};
use lkjstr_protocol::NostrFilter;
use serde_json::{Value, json};
const RELAY: &str = "wss://auth-race.test/";
fn frames(n: &mut Network) -> Vec<Value> {
    n.drain_effects()
        .into_iter()
        .filter_map(|e| match e {
            Effect::Send(_, text) => Some(serde_json::from_str(&text).expect("frame")),
            _ => None,
        })
        .collect()
}
fn message(n: &mut Network, frame: Value, now: u64) {
    n.message(RELAY, &frame.to_string(), now);
}
fn setup() -> (Network, Accounts, String, String) {
    let mut accounts = Accounts::default();
    accounts.add("create", None).expect("A");
    let a = accounts.active.clone().expect("A key");
    accounts.add("create", None).expect("B");
    let b = accounts.active.clone().expect("B key");
    let mut n = Network::default();
    n.configure(vec![RELAY.into()], 0);
    n.plan(
        vec![(
            "feed".into(),
            NostrFilter {
                kinds: Some(vec![1]),
                limit: Some(20),
                ..Default::default()
            },
            Query {
                source: Source::Relay,
                target: Some(RELAY.into()),
                ..Default::default()
            },
        )],
        &Store::new(20000),
        0,
    );
    n.connected(RELAY, 10);
    let req = frames(&mut n)
        .into_iter()
        .find(|f| f[0] == "REQ")
        .expect("REQ");
    message(&mut n, json!(["AUTH", "race"]), 20);
    message(
        &mut n,
        json!(["CLOSED", req[1], "auth-required: fixture"]),
        21,
    );
    (n, accounts, a, b)
}
#[test]
fn switching_active_account_cancels_delayed_public_auth_without_failing_new_reader() {
    let (mut n, accounts, a, b) = setup();
    let keys = vec![a.clone(), b.clone()];
    let job = n.next_auth(&keys, Some(&a), 30).expect("A request");
    let signed = accounts.sign(&job.event).expect("sign").expect("local");
    n.set_auth_accounts(&keys, Some(&b), 35);
    n.auth_signed(&job, Ok(signed), 40);
    assert!(frames(&mut n).iter().all(|f| f[0] != "AUTH"));
    let new = n.next_auth(&keys, Some(&b), 41).expect("B still eligible");
    assert_eq!(new.event.pubkey, b);
}
#[test]
fn account_switch_between_auth_send_and_ack_does_not_resume_as_previous_reader() {
    let (mut n, accounts, a, b) = setup();
    let keys = vec![a.clone(), b.clone()];
    let job = n.next_auth(&keys, Some(&a), 30).expect("A request");
    let signed = accounts.sign(&job.event).expect("sign").expect("local");
    let id = signed.id.clone();
    n.auth_signed(&job, Ok(signed), 32);
    assert!(frames(&mut n).iter().any(|f| f[0] == "AUTH"));
    n.set_auth_accounts(&keys, Some(&b), 35);
    message(&mut n, json!(["OK", id, true, ""]), 40);
    n.tick(41);
    assert!(frames(&mut n).iter().all(|f| f[0] != "REQ"));
    assert_eq!(n.next_auth(&keys, Some(&b), 42).expect("B").event.pubkey, b);
}
#[test]
fn removed_demand_and_revoked_signer_cannot_disclose_a_delayed_auth() {
    let (mut n, accounts, a, _) = setup();
    let keys = vec![a.clone()];
    let job = n.next_auth(&keys, Some(&a), 30).expect("job");
    let signed = accounts.sign(&job.event).expect("sign").expect("local");
    n.plan(vec![], &Store::new(20000), 35);
    n.auth_signed(&job, Ok(signed), 36);
    assert!(frames(&mut n).iter().all(|f| f[0] != "AUTH"));

    let (mut n, accounts, a, _) = setup();
    assert!(
        n.next_auth(&[], Some(&a), 30).is_none(),
        "locked signer does not consume a try"
    );
    let job = n
        .next_auth(std::slice::from_ref(&a), Some(&a), 31)
        .expect("unlocked");
    n.set_auth_accounts(&[], Some(&a), 32);
    n.auth_signed(
        &job,
        Ok(accounts.sign(&job.event).expect("sign").expect("local")),
        33,
    );
    assert!(frames(&mut n).iter().all(|f| f[0] != "AUTH"));
    assert!(
        n.next_auth(std::slice::from_ref(&a), Some(&a), 34)
            .is_some(),
        "unlock can retry the same challenge after cancellation"
    );
}
#[test]
fn an_ack_after_deadline_is_rejected_even_before_timer_tick() {
    let (mut n, accounts, a, _) = setup();
    let job = n
        .next_auth(std::slice::from_ref(&a), Some(&a), 30)
        .expect("job");
    let signed = accounts.sign(&job.event).expect("sign").expect("local");
    let id = signed.id.clone();
    n.auth_signed(&job, Ok(signed), 32);
    frames(&mut n);
    message(&mut n, json!(["OK", id, true, ""]), job.deadline + 1);
    n.tick(job.deadline + 2);
    assert!(frames(&mut n).iter().all(|f| f[0] != "REQ"));
    assert!(
        n.drain_output()
            .iter()
            .any(|o| matches!(o, Output::Status {state, ..} if state == "error"))
    );
}

fn replaced_relay_signer_result(succeeds: bool) {
    let (mut n, accounts, a, _) = setup();
    let keys = std::slice::from_ref(&a);
    let old = n.next_auth(keys, Some(&a), 30).expect("old job");
    n.plan(vec![], &Store::new(0), 35);
    n.configure(vec![], 36);
    assert!(!n.relays.contains_key(RELAY));
    n.configure(vec![RELAY.into()], 37);
    n.plan(
        vec![(
            "feed".into(),
            NostrFilter {
                kinds: Some(vec![1]),
                limit: Some(20),
                ..Default::default()
            },
            Query {
                source: Source::Relay,
                target: Some(RELAY.into()),
                ..Default::default()
            },
        )],
        &Store::new(0),
        38,
    );
    n.connected(RELAY, 39);
    let req = frames(&mut n)
        .into_iter()
        .find(|f| f[0] == "REQ")
        .expect("new route request");
    message(&mut n, json!(["AUTH", "replacement"]), 40);
    message(
        &mut n,
        json!(["CLOSED", req[1], "auth-required: replacement"]),
        41,
    );
    let current = n.next_auth(keys, Some(&a), 45).expect("new route job");
    let result = if succeeds {
        Ok(accounts.sign(&old.event).expect("old sign").expect("local"))
    } else {
        Err("old signer refused")
    };
    n.auth_signed(&old, result, 50);
    assert!(frames(&mut n).iter().all(|f| f[0] != "AUTH"));
    n.auth_signed(
        &current,
        Ok(accounts
            .sign(&current.event)
            .expect("new sign")
            .expect("local")),
        51,
    );
    let auth = frames(&mut n)
        .into_iter()
        .find(|f| f[0] == "AUTH")
        .expect("an old route's signer reply cannot settle the replacement job");
    assert_eq!(auth[1]["tags"][1][1], "replacement");
}
#[test]
fn removed_and_readmitted_relay_ignores_old_signer_success() {
    replaced_relay_signer_result(true);
}
#[test]
fn removed_and_readmitted_relay_ignores_old_signer_failure() {
    replaced_relay_signer_result(false);
}
