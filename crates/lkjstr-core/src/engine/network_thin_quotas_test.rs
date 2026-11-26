#![allow(clippy::expect_used)]
use super::{A, NOW, frames, signed};
use crate::{
    engine::{network::Network, protocol::Query},
    optimizer::link::Hint,
    store::Store,
};
use lkjstr_protocol::NostrFilter;
use serde_json::json;

#[test]
fn thin_hints_preserve_metadata_and_id_quotas_and_release_the_view() {
    for ids in [false, true] {
        let mut network = Network::default();
        network.optimizer.link.set_hint(Some(Hint::VeryThin));
        network.configure(vec![A.into()], NOW);
        let values: Vec<_> = (1..=25).map(|index| format!("{index:064x}")).collect();
        let filter = NostrFilter {
            kinds: (!ids).then(|| vec![0]),
            authors: (!ids).then(|| values.clone()),
            ids: ids.then(|| values.clone()),
            limit: Some(25),
            ..Default::default()
        };
        let store = Store::new(100);
        network.plan(vec![("feed".into(), filter, Query::default())], &store, NOW);
        let buckets: Vec<_> = network.requests.values().collect();
        assert_eq!(buckets.len(), 1);
        let bucket = &buckets[0].filter;
        assert_eq!(bucket.limit, Some(25));
        assert_eq!(
            bucket.authors.as_ref().or(bucket.ids.as_ref()),
            Some(&values)
        );
        network.connected(A, NOW + 100);
        let first = frames(&mut network)
            .into_iter()
            .find(|(_, frame)| frame[0] == "REQ")
            .expect("metadata or ID request")
            .1;
        assert_eq!(first[2]["limit"], 25);
        network.plan(vec![], &store, NOW + 150);
        assert!(
            frames(&mut network)
                .iter()
                .any(|(_, frame)| frame[0] == "CLOSE")
        );
        network.tick(NOW + 6_000);
        assert!(network.requests.is_empty());
        assert!(
            !frames(&mut network)
                .iter()
                .any(|(_, frame)| frame[0] == "REQ")
        );
        let late = signed(190, "late cancelled delivery");
        assert!(
            network
                .message(
                    A,
                    &json!(["EVENT", first[1], late]).to_string(),
                    NOW + 6_001
                )
                .is_none()
        );
    }
}
