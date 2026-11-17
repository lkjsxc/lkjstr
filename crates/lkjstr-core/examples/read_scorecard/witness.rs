//! Exact-equivalence ownership witness; normalization is an explicit control only.
use super::fixture::{Failure, START};
use lkjstr_core::{
    engine::{
        network::{Effect, Network},
        protocol::{Query, Source},
    },
    store::Store,
};
use lkjstr_protocol::NostrFilter;
use serde_json::{Value, json};

const RELAY: &str = "wss://union-witness.test/";
type Want = (String, NostrFilter, Query);

pub fn canonical(filter: &mut NostrFilter) {
    if let Some(values) = &mut filter.ids {
        values.sort();
        values.dedup();
    }
    if let Some(values) = &mut filter.authors {
        values.sort();
        values.dedup();
    }
    if let Some(values) = &mut filter.kinds {
        values.sort();
        values.dedup();
    }
    for values in filter.tags.values_mut() {
        values.sort();
        values.dedup();
    }
}
fn want(name: &str, reverse: bool, normalize: bool) -> Want {
    let mut authors = vec!["a".repeat(64), "b".repeat(64)];
    let mut kinds = vec![1, 6];
    if reverse {
        authors.reverse();
        kinds.reverse();
    }
    let mut filter = NostrFilter {
        authors: Some(authors),
        kinds: Some(kinds),
        limit: Some(200),
        ..Default::default()
    };
    if normalize {
        canonical(&mut filter);
    }
    (
        name.into(),
        filter,
        Query {
            source: Source::Relay,
            target: Some(RELAY.into()),
            ..Default::default()
        },
    )
}
fn frames(network: &mut Network) -> Result<Vec<Value>, Failure> {
    network
        .drain_effects()
        .into_iter()
        .filter_map(|effect| match effect {
            Effect::Send(_, text) => Some(serde_json::from_str(&text).map_err(Into::into)),
            _ => None,
        })
        .collect()
}
pub fn run(normalize: bool) -> Result<Value, Failure> {
    let mut network = Network::default();
    network.configure(vec![RELAY.into()], START);
    network.relay_information(
        RELAY,
        r#"{"supported_nips":[1],"limitation":{"max_filters":1,"max_subscriptions":8}}"#,
    );
    let store = Store::new(0);
    let first = want("home", false, normalize);
    let second = want("another-tab", true, normalize);
    network.plan(vec![first.clone()], &store, START);
    network.connected(RELAY, START + 20);
    let initial = frames(&mut network)?;
    network.plan(vec![first, second.clone()], &store, START + 50);
    let mut joined = frames(&mut network)?;
    for at in [100, 200, 300] {
        network.tick(START + at);
        joined.extend(frames(&mut network)?);
    }
    let requests = initial
        .iter()
        .chain(&joined)
        .filter(|v| v[0] == "REQ")
        .count();
    let logical_filters: usize = initial
        .iter()
        .chain(&joined)
        .filter(|v| v[0] == "REQ")
        .filter_map(Value::as_array)
        .map(|v| v.len().saturating_sub(2))
        .sum();
    let before = network.open_wires().values().sum::<usize>();
    network.plan(vec![second], &store, START + 400);
    let removed = frames(&mut network)?;
    let closes = removed.iter().filter(|v| v[0] == "CLOSE").count();
    let replayed = removed.iter().filter(|v| v[0] == "REQ").count();
    let after = network.open_wires().values().sum::<usize>();
    network.plan(vec![], &store, START + 500);
    let final_frames = frames(&mut network)?;
    Ok(json!({
        "input": if normalize { "semantically-normalized-control" } else { "raw-reordered-equivalents" },
        "requests": requests,
        "logicalFilters": logical_filters,
        "requestsWhenSecondOwnerAdded": joined.iter().filter(|v| v[0] == "REQ").count(),
        "closesWhenOneOwnerRemoved": closes,
        "requestsWhenOneOwnerRemoved": replayed,
        "openWiresBeforeRemoval": before,
        "openWiresAfterRemoval": after,
        "closesWhenLastOwnerRemoved": final_frames.iter().filter(|v| v[0] == "CLOSE").count(),
        "openWiresAfterLastOwner": network.open_wires().values().sum::<usize>(),
        "passesExactEquivalentUnion": requests == 1 && logical_filters == 1 && closes == 0
            && replayed == 0 && before == 1 && after == 1 && network.open_wires().is_empty(),
        "scope": "Exact set equivalence only; finite limit coverage and arbitrary subset union are separate."
    }))
}
