use super::*;
use crate::{
    engine::{network::Network, protocol::Query, settings::PrivateLists, weights::PlanWeights},
    store::Store,
};
use lkjstr_protocol::{NostrEvent, NostrFilter};

fn put(store: &mut Store, id: u64, author: &str, kind: u64, tags: Vec<Vec<String>>) {
    store.insert(
        NostrEvent {
            id: format!("{id:064x}"),
            pubkey: author.into(),
            created_at: id,
            kind,
            tags,
            content: String::new(),
            sig: "0".repeat(128),
        },
        None,
    );
}
fn query(account: &str) -> Query {
    Query {
        account: Some(account.into()),
        ..Default::default()
    }
}
#[test]
fn authorless_routes_and_requests_do_not_build_account_graphs() {
    let mut n = Network::default();
    n.configure(vec!["wss://a.test/".into(), "wss://b.test/".into()], 0);
    let mut store = Store::new(100);
    let owner = "a".repeat(64);
    let follow = "b".repeat(64);
    put(
        &mut store,
        1,
        &owner,
        3,
        vec![vec!["p".into(), follow.clone()]],
    );
    put(
        &mut store,
        2,
        &follow,
        3,
        vec![vec!["p".into(), owner.clone()]; 1000],
    );
    let q = query(&owner);
    let private = PrivateLists::default();
    let mut weights = PlanWeights::new(&store, &private);
    let filters = [
        NostrFilter {
            kinds: Some(vec![1, 6]),
            ..Default::default()
        },
        NostrFilter {
            kinds: Some(vec![1, 6, 7, 9735]),
            tags: BTreeMap::from([("p".into(), vec![follow.clone()])]),
            ..Default::default()
        },
    ];
    n.plan(
        filters
            .iter()
            .enumerate()
            .map(|(i, f)| (i.to_string(), f.clone(), q.clone()))
            .collect(),
        &store,
        0,
    );
    for f in &filters {
        assert_eq!(n.read_routes(f, &q, &store, &mut weights, 0), n.relay_order);
    }
    let queries = BTreeMap::from([("0".into(), &q), ("1".into(), &q)]);
    n.request_policy(&queries, &store, &mut weights);
    assert_eq!(weights.len(), 0);
    // Even an author filter has no weighted coverage without advertised outboxes.
    let unknown = NostrFilter {
        authors: Some(vec![follow]),
        ..Default::default()
    };
    n.read_routes(&unknown, &q, &store, &mut weights, 0);
    assert_eq!(weights.len(), 0);
}
#[test]
fn routing_and_scheduling_reuse_policies_but_keep_accounts_isolated() {
    let mut n = Network::default();
    n.configure(
        vec![
            "wss://a.test/".into(),
            "wss://b.test/".into(),
            "wss://c.test/".into(),
        ],
        0,
    );
    let mut store = Store::new(100);
    let owner = "a".repeat(64);
    let follow = "b".repeat(64);
    let stranger = "c".repeat(64);
    put(
        &mut store,
        1,
        &owner,
        3,
        vec![vec!["p".into(), follow.clone()]],
    );
    put(
        &mut store,
        2,
        &follow,
        10002,
        vec![vec!["r".into(), "wss://c.test/".into(), "write".into()]],
    );
    put(
        &mut store,
        3,
        &stranger,
        10002,
        vec![vec!["r".into(), "wss://a.test/".into(), "write".into()]],
    );
    put(&mut store, 4, &follow, 1, vec![]);
    let q = query(&owner);
    let other = query(&stranger);
    let private = PrivateLists::default();
    let mut weights = PlanWeights::new(&store, &private);
    for kind in [1, 6, 7] {
        let filter = NostrFilter {
            authors: Some(vec![follow.clone(), stranger.clone()]),
            kinds: Some(vec![kind]),
            ..Default::default()
        };
        assert_eq!(
            n.read_routes(&filter, &q, &store, &mut weights, 0)[0],
            "wss://c.test/"
        );
        assert_eq!(weights.request(q.account.as_deref(), &filter), 32);
        assert_eq!(weights.len(), if kind == 1 { 1 } else { 2 });
        assert_eq!(
            n.read_routes(&filter, &other, &store, &mut weights, 0)[0],
            "wss://a.test/"
        );
        assert_eq!(weights.request(other.account.as_deref(), &filter), 64);
        assert_eq!(weights.len(), 2);
    }
    let target = NostrFilter {
        ids: Some(vec![format!("{:064x}", 4)]),
        ..Default::default()
    };
    assert_eq!(weights.request(q.account.as_deref(), &target), 32);
    assert_eq!(weights.len(), 2);
    // Replans see changed follows instead of retaining stale account policies.
    drop(weights);
    put(&mut store, 5, &owner, 3, vec![]);
    let mut refreshed = PlanWeights::new(&store, &private);
    assert_eq!(refreshed.request(q.account.as_deref(), &target), 1);
}
