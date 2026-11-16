#![allow(clippy::expect_used)]
use lkjstr_core::engine::{
    accounts::Accounts,
    network::{Effect, Network},
    protocol::Output,
    publication_plan::Destination,
};
use lkjstr_protocol::{NostrEvent, UnsignedNostrEvent};
use serde_json::{Value, json};
const RELAY: &str = "wss://auth-write.test/";
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
fn owners() -> (Accounts, String, String) {
    let mut accounts = Accounts::default();
    accounts.add("create", None).expect("A");
    let a = accounts.active.clone().expect("A key");
    accounts.add("create", None).expect("B");
    let b = accounts.active.clone().expect("B key");
    (accounts, a, b)
}
fn event(accounts: &Accounts, account: &str, kind: u64) -> NostrEvent {
    accounts
        .sign(&UnsignedNostrEvent {
            pubkey: account.into(),
            created_at: 1,
            kind,
            tags: vec![],
            content: format!("kind {kind}"),
        })
        .expect("sign")
        .expect("local")
}
fn routes() -> Vec<Destination> {
    vec![Destination {
        url: RELAY.into(),
        rule: "own".into(),
        state: "pending".into(),
        reason: None,
    }]
}
fn block(n: &mut Network, events: &[NostrEvent]) {
    n.connected(RELAY, 10);
    frames(n);
    message(n, json!(["AUTH", "write"]), 20);
    for event in events {
        message(
            n,
            json!(["OK", event.id, false, "auth-required: fixture"]),
            21,
        );
    }
    n.drain_output();
}
fn sign(accounts: &Accounts, job: &lkjstr_core::engine::network::auth::AuthRequest) -> NostrEvent {
    accounts.sign(&job.event).expect("sign").expect("local")
}
#[test]
fn a_publication_authenticates_its_explicit_author_even_when_another_account_is_active() {
    let (accounts, a, b) = owners();
    let e = event(&accounts, &b, 1);
    let mut n = Network::default();
    n.publish("B".into(), e.clone(), routes(), 0);
    block(&mut n, &[e]);
    assert_eq!(
        n.next_auth(&[a.clone(), b.clone()], Some(&a), 30)
            .expect("B auth")
            .event
            .pubkey,
        b
    );
}
#[test]
fn refused_auth_fails_only_its_owners_write_and_reports_real_rejection() {
    let (accounts, a, b) = owners();
    let ea = event(&accounts, &a, 1);
    let eb = event(&accounts, &b, 1);
    let mut n = Network::default();
    n.publish("A".into(), ea.clone(), routes(), 0);
    n.publish("B".into(), eb.clone(), routes(), 0);
    block(&mut n, &[ea, eb.clone()]);
    let keys = vec![a.clone(), b.clone()];
    let job = n.next_auth(&keys, Some(&a), 30).expect("A auth");
    let signed = sign(&accounts, &job);
    let id = signed.id.clone();
    n.auth_signed(&job, Ok(signed), 31);
    frames(&mut n);
    message(
        &mut n,
        json!(["OK", id, false, "rate-limited: authentication refused"]),
        32,
    );
    let outcomes = n.drain_output();
    assert!(outcomes.iter().any(|o| matches!(o, Output::Delivery {req, deliveries} if req == "A" && deliveries[0].state == "rejected")));
    assert!(
        !outcomes
            .iter()
            .any(|o| matches!(o, Output::Delivery {req, ..} if req == "B"))
    );
    assert!(n.pending_event(&eb.id));
    assert_eq!(
        n.next_auth(&keys, Some(&a), 33)
            .expect("B still eligible")
            .event
            .pubkey,
        b
    );
}
#[test]
fn successful_auth_retries_only_its_owners_write_until_the_other_owner_authenticates() {
    let (accounts, a, b) = owners();
    let ea = event(&accounts, &a, 1);
    let eb = event(&accounts, &b, 1);
    let mut n = Network::default();
    n.publish("A".into(), ea.clone(), routes(), 0);
    n.publish("B".into(), eb.clone(), routes(), 0);
    block(&mut n, &[ea.clone(), eb.clone()]);
    let keys = vec![a.clone(), b.clone()];
    let job = n.next_auth(&keys, Some(&a), 30).expect("A");
    let signed = sign(&accounts, &job);
    let id = signed.id.clone();
    n.auth_signed(&job, Ok(signed), 31);
    frames(&mut n);
    message(&mut n, json!(["OK", id, true, ""]), 32);
    n.tick(33);
    let sent = frames(&mut n);
    assert!(sent.iter().any(|f| f[0] == "EVENT" && f[1]["id"] == ea.id));
    assert!(!sent.iter().any(|f| f[0] == "EVENT" && f[1]["id"] == eb.id));
    assert_eq!(n.next_auth(&keys, Some(&a), 34).expect("B").event.pubkey, b);
}
#[test]
fn gift_wrap_auth_uses_explicit_sender_never_ephemeral_or_active_identity() {
    let (mut accounts, a, b) = owners();
    accounts.add("create", None).expect("ephemeral");
    let ephemeral = accounts.active.clone().expect("ephemeral key");
    let wrap = event(&accounts, &ephemeral, 1059);
    let keys = vec![a.clone(), ephemeral.clone(), b.clone()];
    let mut n = Network::default();
    n.publish_as("wrap".into(), wrap.clone(), routes(), 0, b.clone());
    block(&mut n, std::slice::from_ref(&wrap));
    assert_eq!(
        n.next_auth(&keys, Some(&a), 30)
            .expect("sender")
            .event
            .pubkey,
        b
    );
    let mut n = Network::default();
    n.publish("unowned-wrap".into(), wrap.clone(), routes(), 0);
    block(&mut n, &[wrap]);
    assert!(
        n.next_auth(&keys, Some(&a), 30).is_none(),
        "missing sender metadata cannot authorize any account"
    );
}
#[test]
fn expired_publication_or_failed_socket_send_never_authorizes_an_account() {
    let (accounts, a, _) = owners();
    let e = event(&accounts, &a, 1);
    let mut n = Network::default();
    n.publish("expiry".into(), e.clone(), routes(), 0);
    block(&mut n, std::slice::from_ref(&e));
    let job = n
        .next_auth(std::slice::from_ref(&a), Some(&a), 30)
        .expect("job");
    n.auth_signed(&job, Ok(sign(&accounts, &job)), 30001);
    assert!(frames(&mut n).iter().all(|f| f[0] != "AUTH"));
    let mut n = Network::default();
    n.publish("unsent".into(), e.clone(), routes(), 0);
    n.connected(RELAY, 10);
    frames(&mut n);
    n.publication_frame_sent(RELAY, &json!(["EVENT", e]).to_string(), false);
    message(&mut n, json!(["AUTH", "unsent"]), 20);
    message(
        &mut n,
        json!(["OK", e.id, false, "auth-required: never sent"]),
        21,
    );
    assert!(
        n.next_auth(std::slice::from_ref(&a), Some(&a), 30)
            .is_none()
    );
}
