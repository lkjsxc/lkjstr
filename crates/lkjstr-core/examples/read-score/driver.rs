use super::{
    fixture::{Fixture, START},
    stats::Stats,
};
use lkjstr_core::engine::{
    Engine,
    network::Effect,
    protocol::{Input, Source},
    query,
};
use lkjstr_protocol::{NostrEvent, matches_filter, parse_filter_value};
use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet};
pub struct Run {
    pub engine: Engine,
    pub stats: Stats,
    pub report: Value,
}
pub fn run(f: &Fixture, history: Option<&str>, day: u64) -> Run {
    let mut e = Engine::new();
    for v in &f.seed {
        e.store.insert(v.clone(), None);
    }
    run_engine(f, e, history, day)
}
pub fn warm(f: &Fixture, prior: &Engine) -> Run {
    let mut engine = Engine::new();
    for event in f.seed.iter().chain(&f.events) {
        if prior.store.get(&event.id).is_some() {
            engine.store.insert(event.clone(), None);
        }
    }
    run_engine(
        f,
        engine,
        Some(&prior.network.quality_json(START + 20_000)),
        1,
    )
}
fn run_engine(f: &Fixture, mut e: Engine, history: Option<&str>, day: u64) -> Run {
    let start = START + day * 86_400_000;
    let mut full = lkjstr_core::store::Store::new(5000);
    for v in f.seed.iter().chain(&f.events) {
        full.insert(v.clone(), None);
    }
    let mut s = Stats {
        held: f
            .seed
            .iter()
            .chain(&f.events)
            .filter(|v| e.store.get(&v.id).is_some())
            .map(|v| v.id.clone())
            .collect(),
        ..Default::default()
    };
    for (sub, q) in &f.queries {
        let ids: Vec<_> = query::events(&full, q)
            .iter()
            .map(|v| v.id.clone())
            .collect();
        s.wanted.extend(ids.iter().cloned());
        let count = if q.source == Source::Home { 50 } else { 1 };
        s.expected
            .insert(sub.clone(), ids.into_iter().take(count).collect());
        s.screens.insert(sub.clone(), None);
    }
    if let Some(history) = history {
        e.network.restore_quality(history, start);
    }
    e.input(
        Input::Configure {
            relays: f.relays.clone(),
        },
        start,
    );
    for (sub, q) in &f.queries {
        e.input(
            Input::Open {
                sub: sub.clone(),
                query: q.clone(),
            },
            start,
        );
        e.input(
            Input::Window {
                sub: sub.clone(),
                anchor: None,
                before: 0,
                after: 800,
            },
            start,
        );
    }
    let mut sockets = BTreeSet::new();
    let mut active = BTreeMap::<(String, String), Vec<lkjstr_protocol::NostrFilter>>::new();
    let mut pending = BTreeMap::<u64, Vec<(String, String, Option<NostrEvent>)>>::new();
    for elapsed in (0..=20_000).step_by(25) {
        let now = start + elapsed;
        if [2500, 6000, 8000].contains(&elapsed) {
            let visible: Vec<_> = f
                .queries
                .iter()
                .map(|(sub, _)| sub.clone())
                .filter(|sub| elapsed != 6000 || sub != "profile2")
                .collect();
            e.input(
                Input::Hint {
                    visible_subs: visible,
                    focused_sub: Some(format!("profile{}", day % 3)),
                    page_hidden: false,
                    idle: false,
                    save_data: false,
                },
                now,
            );
        }
        if elapsed == 4000 {
            let id = s.rows.get("home").and_then(|v| v.first()).cloned();
            e.input(
                Input::Reading {
                    sub: "home".into(),
                    id,
                },
                now,
            );
        }
        if elapsed == 10000 {
            e.input(
                Input::Close {
                    sub: "profile0".into(),
                },
                now,
            );
        }
        if elapsed == 12000 {
            e.input(
                Input::Open {
                    sub: "profile0".into(),
                    query: f.queries[2].1.clone(),
                },
                now,
            );
        }
        let due: Vec<_> = pending.range(..=now).map(|(at, _)| *at).collect();
        for at in due {
            for (relay, sub, event) in pending.remove(&at).expect("due") {
                if !active.contains_key(&(relay.clone(), sub.clone())) {
                    continue;
                }
                let text = if let Some(event) = &event {
                    json!(["EVENT", sub, event]).to_string()
                } else {
                    json!(["EOSE", sub]).to_string()
                };
                if let Some(event) = &event {
                    s.event(&relay, &sub, event, text.len());
                } else {
                    s.bytes_in += text.len();
                    if let Some((done, _)) =
                        s.requests_received.get_mut(&(relay.clone(), sub.clone()))
                    {
                        *done = true;
                    }
                }
                if let Some(event) = e.network.message(&relay, &text, now) {
                    e.enqueue(relay, event);
                }
            }
        }
        e.tick(now);
        s.output(&mut e, elapsed);
        for effect in e.network.drain_effects() {
            match effect {
                Effect::Connect(url) => {
                    s.connections += 1;
                    sockets.insert(url.clone());
                    s.max_connections = s.max_connections.max(sockets.len());
                    e.network.connected(&url, now);
                }
                Effect::Disconnect(url) => {
                    sockets.remove(&url);
                    active.retain(|(u, _), _| *u != url);
                }
                Effect::Inspect(url) => {
                    e.network.relay_information(&url,r#"{"supported_nips":[1,11],"limitation":{"max_limit":800,"max_subscriptions":16,"max_filters":16}}"#);
                }
                Effect::Send(url, text) => {
                    s.bytes_out += text.len();
                    let frame: Value = serde_json::from_str(&text).expect("effect frame");
                    let sub = frame[1].as_str().expect("subscription").to_owned();
                    if frame[0] == "CLOSE" {
                        s.closes += 1;
                        active.remove(&(url, sub));
                        continue;
                    }
                    assert_eq!(frame[0], "REQ", "read-only fixture");
                    s.requests += 1;
                    s.requests_received
                        .insert((url.clone(), sub.clone()), (false, BTreeSet::new()));
                    let filters: Vec<_> = frame
                        .as_array()
                        .expect("REQ")
                        .iter()
                        .skip(2)
                        .map(|v| parse_filter_value(v).expect("filter"))
                        .collect();
                    active.insert((url.clone(), sub.clone()), filters.clone());
                    let mut found = BTreeMap::new();
                    for filter in &filters {
                        let mut candidates: Vec<_> = f
                            .events
                            .iter()
                            .chain(&f.seed)
                            .filter(|v| f.holds(&url, v) && matches_filter(v, filter))
                            .collect();
                        candidates.sort_by_key(|v| (std::cmp::Reverse(v.created_at), v.id.clone()));
                        for event in candidates
                            .into_iter()
                            .take(filter.limit.unwrap_or(800) as usize)
                        {
                            found.insert(event.id.clone(), event.clone());
                        }
                    }
                    if !found
                        .values()
                        .any(|v| s.wanted.contains(&v.id) && e.store.get(&v.id).is_none())
                    {
                        s.predicted_zero_yield_requests += 1;
                    }
                    let delivery = now + f.latency(&url);
                    let queue = pending.entry(delivery).or_default();
                    queue.extend(
                        found
                            .into_values()
                            .map(|v| (url.clone(), sub.clone(), Some(v))),
                    );
                    queue.push((url, sub, None));
                }
            }
        }
    }
    assert_eq!(e.rejected, 0, "signed fixture");
    assert_eq!(e.dropped, 0, "bounded fixture");
    let report = s.report(&e.store);
    Run {
        engine: e,
        stats: s,
        report,
    }
}
