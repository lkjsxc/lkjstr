#![allow(clippy::expect_used)]
use super::{A, NOW, frames, signed};
use crate::{
    engine::{
        Engine,
        network::Network,
        protocol::{Input, Query, Source},
    },
    optimizer::link::Hint,
    store::Store,
};
use lkjstr_protocol::{NostrEvent, NostrFilter};
use serde_json::{Value, json};

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

fn answer_notes(engine: &mut Engine, request: &Value, notes: &[NostrEvent], now: u64) {
    let filter = lkjstr_protocol::parse_filter_value(&request[2]).expect("note filter");
    // The local relay obeys the transmitted quota, including on overlapping pages.
    for note in notes
        .iter()
        .filter(|note| lkjstr_protocol::matches_filter(note, &filter))
        .take(filter.limit.expect("bounded page") as usize)
    {
        let accepted = engine
            .network
            .message(A, &json!(["EVENT", request[1], note]).to_string(), now)
            .expect("requested signed note");
        engine.enqueue(A.into(), accepted);
    }
    engine
        .network
        .message(A, &json!(["EOSE", request[1]]).to_string(), now + 1);
}

#[test]
fn thin_hint_preserves_engine_history_progress_through_more_than_eight_ties() {
    let mut engine = Engine::new();
    engine.input(
        Input::LinkHint {
            hint: Some(Hint::VeryThin),
        },
        NOW,
    );
    engine.input(
        Input::Configure {
            relays: vec![A.into()],
        },
        NOW,
    );
    let query = Query {
        source: Source::Relay,
        target: Some(A.into()),
        ..Default::default()
    };
    engine.input(
        Input::Open {
            sub: "feed".into(),
            query: query.clone(),
        },
        NOW,
    );
    engine.input(
        Input::Window {
            sub: "feed".into(),
            anchor: None,
            before: 0,
            after: 20,
        },
        NOW,
    );
    engine.network.connected(A, NOW + 10);
    let head = frames(&mut engine.network)
        .into_iter()
        .find(|(_, frame)| frame[0] == "REQ" && frame[2]["kinds"] == json!([1, 6]))
        .expect("initial note page")
        .1;
    assert_eq!(head[2]["limit"], 8);
    let mut notes: Vec<_> = (0..12)
        .map(|index| signed(190, &format!("same-second-{index}")))
        .collect();
    let older = signed(189, "older tail beyond all twelve ties");
    notes.push(older.clone());
    notes.sort_by(|a, b| b.created_at.cmp(&a.created_at).then(a.id.cmp(&b.id)));
    answer_notes(&mut engine, &head, &notes, NOW + 20);
    let mut continuation = None;
    for step in 1..=8 {
        let now = NOW + step * 100;
        engine.tick(now);
        for (_, frame) in frames(&mut engine.network)
            .into_iter()
            .filter(|(_, frame)| frame[0] == "REQ")
        {
            if frame[2]["kinds"] == json!([1, 6]) && frame[2]["until"] == 190 {
                continuation = Some(frame);
            } else {
                engine
                    .network
                    .message(A, &json!(["EOSE", frame[1]]).to_string(), now);
            }
        }
        if continuation.is_some() {
            break;
        }
    }
    let continuation = continuation.expect("engine automatically refills the full head");
    assert_eq!(engine.store.len(), 8);
    assert!(
        !engine
            .network
            .page_exhausted(&crate::engine::query::filter(&engine.store, &query,))
    );
    answer_notes(&mut engine, &continuation, &notes, NOW + 1_000);
    engine.tick(NOW + 1_100);
    assert!(
        engine.store.get(&older.id).is_some(),
        "a persistent thin hint must not strand history at an eight-note tied timestamp"
    );
    assert!(
        notes
            .iter()
            .all(|note| engine.store.get(&note.id).is_some())
    );
    assert_eq!(continuation[2]["limit"], 200);
    let history = engine.views["feed"]
        .history
        .as_ref()
        .expect("historical owner");
    assert_eq!(history.until, Some(190), "the boundary stays inclusive");
    assert!(engine.network.page_exhausted(history));
    let link = engine.network.optimizer.link.state();
    assert_eq!(link.throughput_bps, 6_250);
    assert_eq!(link.samples, 0, "the hint remained active for every page");
}
