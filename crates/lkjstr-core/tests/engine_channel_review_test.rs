#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::{RELAY, accept, event, frames, output};
use lkjstr_core::engine::{Engine, channels, protocol, wire};
use lkjstr_protocol::{
    EventTemplate, finalize_event, generate_secret_key, matches_filter, parse_filter_value,
};
use serde_json::json;

#[test]
fn busy_channel_fetches_metadata_independently_of_newer_messages() {
    let key = generate_secret_key();
    let signed = |at, kind, content: &str, tags| {
        finalize_event(
            &EventTemplate {
                pubkey: None,
                created_at: at,
                kind,
                content: content.into(),
                tags,
            },
            &key,
        )
        .expect("fixture")
    };
    let creation = signed(1, 40, r#"{"name":"Original"}"#, vec![]);
    let root = vec![vec![
        "e".into(),
        creation.id.clone(),
        RELAY.into(),
        "root".into(),
    ]];
    let update = signed(
        2,
        41,
        r#"{"name":"Updated","about":"New about","picture":"https://example.test/new.png"}"#,
        root.clone(),
    );
    let mut fixtures = (0..230)
        .map(|i| signed(100 + i, 42, "message", root.clone()))
        .collect::<Vec<_>>();
    fixtures.extend([creation.clone(), update.clone()]);
    fixtures.sort_by(|a, b| (b.created_at, &b.id).cmp(&(a.created_at, &a.id)));
    for source in ["channels", "channel"] {
        let mut e = Engine::new();
        let mut s = wire::Session::default();
        e.input(
            protocol::Input::Configure {
                relays: vec![RELAY.into()],
            },
            0,
        );
        accept(
            &mut s,
            &mut e,
            json!({"t":"open","sub":"room","query":{"source":source,"id":creation.id}}),
            0,
        );
        e.network.connected(RELAY, 1);
        for now in (100..6000).step_by(100) {
            for frame in frames(&mut e).iter().filter(|f| f[0] == "REQ") {
                let filter = parse_filter_value(&frame[2]).expect("filter");
                for item in fixtures
                    .iter()
                    .filter(|e| matches_filter(e, &filter))
                    .take(filter.limit.unwrap_or(200) as usize)
                {
                    if let Some(item) =
                        e.network
                            .message(RELAY, &json!(["EVENT", frame[1], item]).to_string(), now)
                    {
                        e.enqueue(RELAY.into(), item);
                    }
                }
                e.network
                    .message(RELAY, &json!(["EOSE", frame[1]]).to_string(), now);
            }
            e.tick(now);
            output(&mut s, &mut e);
        }
        assert!(
            e.store.get(&update.id).is_some(),
            "{source} retrieves older metadata"
        );
        let data = channels::metadata(&e.store, &creation.id).0;
        assert_eq!(data["name"], "Updated");
        assert_eq!(data["about"], "New about");
        assert_eq!(data["picture"], "https://example.test/new.png");
    }
}

#[test]
fn repost_notification_filter_keeps_ordinary_and_channel_reposts_only() {
    let mut e = Engine::new();
    let creation = event(1, 40, r#"{"name":"Room"}"#, vec![]);
    let target = event(
        2,
        42,
        "channel note",
        vec![vec![
            "e".into(),
            creation.id.clone(),
            "".into(),
            "root".into(),
        ]],
    );
    let note = event(3, 1, "ordinary note", vec![]);
    let account = event(6, 1, "", vec![]).pubkey;
    let repost = |at, kind, target: &lkjstr_protocol::NostrEvent| {
        event(
            at,
            kind,
            "",
            vec![
                vec!["e".into(), target.id.clone()],
                vec!["p".into(), target.pubkey.clone()],
                vec!["k".into(), target.kind.to_string()],
                vec!["p".into(), account.clone()],
            ],
        )
    };
    let generic = repost(4, 16, &target);
    let ordinary = repost(5, 6, &note);
    for item in [generic, ordinary, repost(7, 7, &target)] {
        e.store.insert(item, None);
    }
    for item in [creation.clone(), target.clone(), note.clone()] {
        e.store.insert(item, None);
    }
    let mut s = wire::Session::default();
    accept(
        &mut s,
        &mut e,
        json!({"t":"open","sub":"reposts","query":{"source":"notifications","account":account,"types":["repost"]}}),
        1000,
    );
    let messages = output(&mut s, &mut e);
    let rows = messages.iter().find(|m| m["t"] == "rows").expect("rows")["rows"]
        .as_array()
        .expect("array");
    assert_eq!(rows.len(), 2);
    assert!(rows.iter().all(|r| r["type"] == "repost"));
    let channel = rows
        .iter()
        .find(|r| r["target"]["id"] == target.id)
        .expect("channel repost");
    assert_eq!(channel["target"]["excerpt"], "channel note");
    assert!(rows.iter().any(|r| r["target"]["id"] == note.id));
}

#[test]
fn pending_counts_can_interrupt_settled_channel_work_on_a_full_relay() {
    use lkjstr_core::engine::network::{Effect, Network};
    use lkjstr_protocol::NostrFilter;
    let mut n = Network::default();
    n.configure(vec![RELAY.into()], 0);
    n.relay_information(RELAY, r#"{"limitation":{"max_subscriptions":1}}"#);
    let channel = NostrFilter {
        kinds: Some(vec![41]),
        limit: Some(200),
        ..Default::default()
    };
    let mut counts = NostrFilter {
        kinds: Some(vec![42, 16, 7, 9735]),
        limit: Some(200),
        ..Default::default()
    };
    counts.tags.insert("e".into(), vec!["a".repeat(64)]);
    n.plan(
        vec![("room".into(), channel.clone(), protocol::Query::default())],
        &lkjstr_core::store::Store::new(0),
        0,
    );
    n.connected(RELAY, 1);
    let sends = |n: &mut Network| {
        n.drain_effects()
            .into_iter()
            .filter_map(|e| match e {
                Effect::Send(_, s) => {
                    Some(serde_json::from_str::<serde_json::Value>(&s).expect("frame"))
                }
                _ => None,
            })
            .collect::<Vec<_>>()
    };
    let request = sends(&mut n)
        .into_iter()
        .find(|f| f[0] == "REQ")
        .expect("metadata request");
    n.message(RELAY, &json!(["EOSE", request[1]]).to_string(), 2);
    n.plan(
        vec![
            ("room".into(), channel, protocol::Query::default()),
            ("room".into(), counts, protocol::Query::default()),
        ],
        &lkjstr_core::store::Store::new(0),
        110,
    );
    let frames = sends(&mut n);
    assert!(frames.iter().any(|f| f[0] == "CLOSE" && f[1] == request[1]));
    let count = frames
        .iter()
        .find(|f| f[0] == "REQ" && f[2]["kinds"] == json!([42, 16, 7, 9735]))
        .expect("counts request");
    n.message(RELAY, &json!(["EOSE", count[1]]).to_string(), 111);
    n.tick(112);
    assert!(n.drain_output().iter().any(|o| matches!(o, protocol::Output::Status { sub, state, .. } if sub == "room" && state == "not-found")));
    n.tick(1220);
    assert!(
        sends(&mut n)
            .iter()
            .any(|f| f[0] == "REQ" && f[2]["kinds"] == json!([41]))
    );
}
