#![allow(clippy::expect_used)]
use lkjstr_core::{
    engine::{
        network::{Effect, Network},
        protocol::{Query, Source},
        query,
    },
    store::Store,
};
use lkjstr_protocol::{EventTemplate, NostrEvent, finalize_event, generate_secret_key};
use serde_json::{Value, json};
const A: &str = "wss://a.test/";
const B: &str = "wss://b.test/";
const WRITE: &str = "wss://writer.test/";
const READ: &str = "wss://reader.test/";
fn list(key: &lkjstr_protocol::SecretKeyBytes, at: u64, tags: Vec<Vec<String>>) -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: at,
            kind: 10002,
            content: String::new(),
            tags,
        },
        key,
    )
    .expect("list")
}
fn fixture() -> (Network, Store, Query, lkjstr_protocol::SecretKeyBytes) {
    let key = generate_secret_key();
    let event = list(
        &key,
        10,
        vec![
            vec!["r".into(), WRITE.into(), "write".into()],
            vec!["r".into(), READ.into(), "read".into()],
        ],
    );
    let author = event.pubkey.clone();
    let mut store = Store::new(100);
    store.insert(event, None);
    let mut network = Network::default();
    network.configure(vec![A.into(), B.into()], 20_000);
    let query = Query {
        source: Source::Profile,
        target: Some(author),
        ..Default::default()
    };
    (network, store, query, key)
}
fn requests(network: &mut Network, now: u64) -> Vec<(String, Value)> {
    let urls: Vec<_> = network.relays.keys().cloned().collect();
    for url in urls {
        if network.relays[&url].connecting {
            network.connected(&url, now);
        }
    }
    network
        .drain_effects()
        .into_iter()
        .filter_map(|effect| match effect {
            Effect::Send(url, text) => {
                let f: Value = serde_json::from_str(&text).expect("frame");
                (f[0] == "REQ").then_some((url, f))
            }
            _ => None,
        })
        .collect()
}
fn plan(network: &mut Network, store: &Store, q: &Query, now: u64) {
    network.plan(
        vec![("view".into(), query::filter(store, q), q.clone())],
        store,
        now,
    );
}
#[test]
fn author_reads_use_signed_write_relays_and_keep_configured_fallback() {
    let (mut network, store, q, _) = fixture();
    plan(&mut network, &store, &q, 20_000);
    let frames = requests(&mut network, 20_010);
    assert!(
        frames
            .iter()
            .any(|(url, f)| url == WRITE && f[2]["authors"] == json!([q.target]))
    );
    assert!(frames.iter().any(|(url, _)| url == A || url == B));
    assert!(!network.relays.contains_key(READ));
    network.plan(vec![], &store, 20_100);
    assert!(!network.relays.contains_key(WRITE));
}
#[test]
fn mentions_and_thread_replies_use_read_roles_not_write_roles() {
    for source in [Source::Notifications, Source::Thread] {
        let (mut network, store, mut q, _) = fixture();
        q.account = q.target.clone();
        q.source = source;
        q.target = Some("a".repeat(64));
        plan(&mut network, &store, &q, 20_000);
        let frames = requests(&mut network, 20_010);
        assert!(frames.iter().any(|(url, _)| url == READ));
        assert!(!network.relays.contains_key(WRITE));
    }
}
#[test]
fn new_verified_discovery_joins_without_cancelling_inflight_fallbacks() {
    let (mut network, store, q, _) = fixture();
    let mut empty = Store::new(100);
    plan(&mut network, &empty, &q, 20_000);
    assert_eq!(requests(&mut network, 20_010).len(), 2);
    empty.insert(
        store
            .replaceable(q.target.as_deref().expect("author"), 10002)
            .expect("list")
            .as_ref()
            .clone(),
        None,
    );
    plan(&mut network, &empty, &q, 20_100);
    assert!(
        requests(&mut network, 20_110)
            .iter()
            .any(|(url, _)| url == WRITE)
    );
    assert!(network.relays[A].online && network.relays[B].online);
}
#[test]
fn newest_list_replaces_routes_and_invalid_hints_never_become_transports() {
    let (mut network, mut store, q, key) = fixture();
    store.insert(
        list(
            &key,
            11,
            vec![
                vec!["r".into(), "wss://new-writer.test/".into(), "write".into()],
                vec!["r".into(), "wss://user:password@bad.test/".into()],
                vec!["r".into(), "ftp://bad.test/".into()],
            ],
        ),
        None,
    );
    store.insert(
        list(
            &key,
            9,
            vec![vec!["r".into(), WRITE.into(), "write".into()]],
        ),
        None,
    );
    plan(&mut network, &store, &q, 20_000);
    let frames = requests(&mut network, 20_010);
    assert!(
        frames
            .iter()
            .any(|(url, _)| url == "wss://new-writer.test/")
    );
    assert!(!network.relays.contains_key(WRITE));
    assert!(network.relays.keys().all(|url| !url.contains("bad.test")));
}

#[test]
fn advertised_routes_cannot_override_an_explicit_read_disable() {
    let (mut network, store, q, _) = fixture();
    network.configure(vec![A.into(), B.into(), WRITE.into()], 20_000);
    network.known.get_mut(WRITE).expect("configured route").read = false;
    plan(&mut network, &store, &q, 20_000);
    let frames = requests(&mut network, 20_010);
    assert!(frames.iter().all(|(url, _)| url != WRITE));
    assert!(frames.iter().any(|(url, _)| url == A || url == B));
}
