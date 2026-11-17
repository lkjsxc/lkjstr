//! Local signed fixtures only. No transport or wall-clock access.
#![allow(clippy::expect_used, dead_code)]
use lkjstr_core::{
    engine::{
        network::{Effect, Network},
        protocol::{Query, Source},
    },
    store::Store,
};
use lkjstr_protocol::{
    EventTemplate, NostrEvent, NostrFilter, finalize_event, parse_secret_key_hex,
};
use serde_json::{Value, json};
pub const R: &str = "wss://union.test/";
pub const NOW: u64 = 1_800_000_000_000;
pub type Want = (String, NostrFilter, Query);
pub fn event(person: u8, at: u64, kind: u64, tags: Vec<Vec<String>>) -> NostrEvent {
    let key = parse_secret_key_hex(&format!("{person:02x}").repeat(32)).expect("fixture key");
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: at,
            kind,
            content: "A visible fixture note".into(),
            tags,
        },
        &key,
    )
    .expect("signed fixture")
}
pub fn frames(n: &mut Network) -> Vec<Value> {
    n.drain_effects()
        .into_iter()
        .filter_map(|e| match e {
            Effect::Send(_, text) => Some(serde_json::from_str(&text).expect("wire")),
            _ => None,
        })
        .collect()
}
pub fn setup(cap: usize, slots: usize) -> Network {
    let mut n = Network::default();
    n.configure(vec![R.into()], NOW);
    n.relay_information(
        R,
        &json!({"limitation":{"max_filters":cap,"max_subscriptions":slots}}).to_string(),
    );
    n.focused_sub = Some("home".into());
    n
}
pub fn fixture() -> (Vec<Want>, Vec<NostrEvent>, Store) {
    let mut events: Vec<_> = (1..=3)
        .flat_map(|person| {
            [
                event(person, 10 * u64::from(person), 1, vec![]),
                event(person, 10 * u64::from(person) + 1, 1, vec![]),
            ]
        })
        .collect();
    events.extend((0..201).map(|i| event(4, 1000 + i, 1, vec![])));
    let people: Vec<_> = (1..=4)
        .map(|person| event(person, 0, 1, vec![]).pubkey)
        .collect();
    let follows = event(
        9,
        1,
        3,
        people.iter().map(|p| vec!["p".into(), p.clone()]).collect(),
    );
    let account = follows.pubkey.clone();
    let mut store = Store::new(1000);
    store.insert(follows, None);
    events.push(event(5, 90, 7, vec![vec!["p".into(), account.clone()]]));
    let home = Query {
        source: Source::Home,
        account: Some(account.clone()),
        ..Default::default()
    };
    let mut wants = vec![(
        "home".into(),
        lkjstr_core::engine::query::filter(&store, &home),
        home,
    )];
    for (i, person) in people.iter().take(3).enumerate() {
        let q = Query {
            source: Source::Profile,
            account: Some(account.clone()),
            target: Some(person.clone()),
            ..Default::default()
        };
        wants.push((
            format!("profile{i}"),
            lkjstr_core::engine::query::filter(&store, &q),
            q,
        ));
    }
    let q = Query {
        source: Source::Notifications,
        account: Some(account),
        ..Default::default()
    };
    wants.push((
        "notifications".into(),
        lkjstr_core::engine::query::filter(&store, &q),
        q,
    ));
    (wants, events, store)
}
pub fn acquire(n: &mut Network, wants: Vec<Want>, store: &Store) -> Vec<Value> {
    n.plan(wants, store, NOW);
    n.connected(R, NOW + 1);
    let mut result = frames(n);
    for at in [101, 201, 301, 401] {
        n.tick(NOW + at);
        result.extend(frames(n));
    }
    result.into_iter().filter(|f| f[0] == "REQ").collect()
}
