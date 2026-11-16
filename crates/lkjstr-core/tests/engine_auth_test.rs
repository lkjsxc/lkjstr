#![allow(clippy::expect_used)]
use lkjstr_core::{
    engine::{
        accounts::Accounts,
        network::{Effect, Network},
        protocol::{Query, Source},
    },
    store::Store,
};
use lkjstr_protocol::{NostrEvent, NostrFilter};
use serde_json::{Value, json};
const RELAY: &str = "wss://auth.test/";
fn frames(n: &mut Network) -> Vec<Value> {
    n.drain_effects()
        .into_iter()
        .filter_map(|e| match e {
            Effect::Send(_, text) => Some(serde_json::from_str(&text).expect("frame")),
            _ => None,
        })
        .collect()
}
fn frame(n: &mut Network, value: Value, now: u64) {
    n.message(RELAY, &value.to_string(), now);
}
fn setup(filter: NostrFilter) -> (Network, Value, Accounts, String) {
    let mut n = Network::default();
    n.configure(vec![RELAY.into()], 0);
    n.plan(
        vec![(
            "feed".into(),
            filter,
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
        .find(|v| v[0] == "REQ")
        .expect("request");
    let mut accounts = Accounts::default();
    accounts.add("create", None).expect("fixture account");
    let owner = accounts.active.clone().expect("owner");
    (n, req, accounts, owner)
}
fn filter() -> NostrFilter {
    NostrFilter {
        kinds: Some(vec![1]),
        limit: Some(50),
        ..Default::default()
    }
}
fn block(n: &mut Network, req: &Value) {
    frame(n, json!(["AUTH", "test-challenge"]), 20);
    frame(n, json!(["CLOSED", req[1], "auth-required: sign in"]), 21);
}
fn sign(accounts: &Accounts, job: &lkjstr_core::engine::network::auth::AuthRequest) -> NostrEvent {
    accounts
        .sign(&job.event)
        .expect("sign")
        .expect("local signature")
}
#[test]
fn challenge_is_not_permission_to_disclose_an_account() {
    let (mut n, req, _, owner) = setup(filter());
    frame(&mut n, json!(["AUTH", "test-challenge"]), 20);
    assert!(
        n.next_auth(std::slice::from_ref(&owner), Some(&owner), 21)
            .is_none()
    );
    frame(
        &mut n,
        json!(["CLOSED", req[1], "auth-required: sign in"]),
        22,
    );
    assert!(n.next_auth(&[], None, 23).is_none());
    assert!(
        n.next_auth(&[owner], None, 23).is_none(),
        "inactive saved key must not sign for visitor"
    );
    n.tick(300);
    assert!(
        frames(&mut n)
            .iter()
            .all(|v| v[0] != "REQ" && v[0] != "AUTH")
    );
}
#[test]
fn auth_is_exact_ephemeral_and_reopens_rejected_request_after_ack_only() {
    let (mut n, req, accounts, owner) = setup(filter());
    block(&mut n, &req);
    let job = n
        .next_auth(std::slice::from_ref(&owner), Some(&owner), 30)
        .expect("auth job");
    assert_eq!(job.event.kind, 22242);
    assert_eq!(
        job.event.tags,
        vec![vec!["relay", RELAY], vec!["challenge", "test-challenge"]]
    );
    assert!(job.event.content.is_empty());
    let event = sign(&accounts, &job);
    n.auth_signed(&job, Ok(event.clone()), 40);
    let sent = frames(&mut n);
    assert_eq!(sent.len(), 1);
    assert_eq!(sent[0][0], "AUTH");
    assert_eq!(sent[0][1]["id"], event.id);
    n.tick(400);
    assert!(frames(&mut n).iter().all(|v| v[0] != "REQ"));
    frame(&mut n, json!(["OK", event.id, true, ""]), 401);
    n.tick(402);
    let reopened = frames(&mut n)
        .into_iter()
        .find(|v| v[0] == "REQ")
        .expect("reopened");
    assert_eq!(reopened[2], req[2]);
    assert_ne!(
        reopened[1], req[1],
        "stale closed/event frames need a new envelope"
    );
}
#[test]
fn a_changed_signer_event_never_becomes_auth_or_publication() {
    let (mut n, req, accounts, owner) = setup(filter());
    block(&mut n, &req);
    let job = n
        .next_auth(std::slice::from_ref(&owner), Some(&owner), 30)
        .expect("job");
    let mut changed = job.clone();
    changed.event.tags[1][1] = "changed".into();
    n.auth_signed(&job, Ok(sign(&accounts, &changed)), 40);
    assert!(
        frames(&mut n)
            .iter()
            .all(|v| v[0] != "AUTH" && v[0] != "EVENT")
    );
    assert!(
        n.next_auth(std::slice::from_ref(&owner), Some(&owner), 50)
            .is_none(),
        "refusal does not reprompt"
    );
}
#[test]
fn disconnect_and_rotated_challenge_reject_delayed_signatures() {
    let (mut n, req, accounts, owner) = setup(filter());
    block(&mut n, &req);
    let job = n
        .next_auth(std::slice::from_ref(&owner), Some(&owner), 30)
        .expect("job");
    frame(&mut n, json!(["AUTH", "next-challenge"]), 35);
    n.auth_signed(&job, Ok(sign(&accounts, &job)), 40);
    assert!(frames(&mut n).iter().all(|v| v[0] != "AUTH"));
    let current = n
        .next_auth(std::slice::from_ref(&owner), Some(&owner), 45)
        .expect("new challenge");
    n.disconnected(RELAY, 50);
    n.connected(RELAY, 60);
    n.auth_signed(&current, Ok(sign(&accounts, &current)), 70);
    assert!(frames(&mut n).iter().all(|v| v[0] != "AUTH"));
}
#[test]
fn a_private_inbox_uses_its_owner_not_the_active_other_account() {
    let mut accounts = Accounts::default();
    accounts.add("create", None).expect("first");
    let first = accounts.active.clone().expect("first owner");
    accounts.add("create", None).expect("second");
    let second = accounts.active.clone().expect("second owner");
    let mut f = filter();
    f.kinds = Some(vec![1059]);
    f.tags.insert("p".into(), vec![first.clone()]);
    let (mut n, req, _, _) = setup(f);
    block(&mut n, &req);
    let job = n
        .next_auth(&[second.clone(), first.clone()], Some(&second), 30)
        .expect("private job");
    assert_eq!(job.event.pubkey, first);
}
#[test]
fn an_unanswered_auth_finishes_as_failed_instead_of_empty() {
    let (mut n, req, accounts, owner) = setup(filter());
    block(&mut n, &req);
    let job = n
        .next_auth(std::slice::from_ref(&owner), Some(&owner), 30)
        .expect("job");
    n.auth_signed(&job, Ok(sign(&accounts, &job)), 40);
    n.tick(60_031);
    assert!(n.drain_output().iter().any(|o| matches!(o,
        lkjstr_core::engine::protocol::Output::Status { state, .. } if state == "error")));
}
