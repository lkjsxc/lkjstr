#![allow(clippy::expect_used)]
mod engine_review_support;
use engine_review_support::*;
use lkjstr_core::engine::{Engine, protocol::Input, wire::Session};
use serde_json::json;
#[test]
fn mixed_history_pages_notifications_independently_of_an_exhausted_note_feed() {
    let mut e = Engine::new();
    let mut s = Session::default();
    let account = "f".repeat(64);
    let target = event(1, 1, "target", vec![]);
    e.store.insert(target.clone(), None);
    let notices = (1..=8)
        .rev()
        .map(|i| {
            event(
                i * 10,
                7,
                &format!("reaction {i}"),
                vec![
                    vec!["p".into(), account.clone()],
                    vec!["e".into(), target.id.clone()],
                ],
            )
        })
        .collect::<Vec<_>>();
    e.input(
        Input::Configure {
            relays: vec![RELAY.into()],
        },
        0,
    );
    e.network
        .relay_information(RELAY, r#"{"limitation":{"max_limit":3}}"#);
    accept(
        &mut s,
        &mut e,
        json!({"t":"open","sub":"feed","query":{"source":"global","account":account,"notifications":true,"since":10000,"until":100000}}),
        0,
    );
    accept(
        &mut s,
        &mut e,
        json!({"t":"window","sub":"feed","anchor":"top","before":0,"after":800}),
        0,
    );
    e.network.connected(RELAY, 1);
    let mut rows = vec![];
    let mut paged = false;
    let mut bottom = false;
    for now in (100..=8000).step_by(100) {
        for f in frames(&mut e).into_iter().filter(|f| f[0] == "REQ") {
            if f[2]["kinds"] == json!([1, 3, 6, 7, 9735]) {
                let until = f[2]["until"].as_u64().unwrap_or(100);
                paged |= until < 100;
                for notice in notices.iter().filter(|n| n.created_at <= until).take(3) {
                    if let Some(event) =
                        e.network
                            .message(RELAY, &json!(["EVENT", f[1], notice]).to_string(), now)
                    {
                        e.enqueue(RELAY.into(), event);
                    }
                }
            }
            e.network
                .message(RELAY, &json!(["EOSE", f[1]]).to_string(), now);
        }
        e.tick(now);
        for m in output(&mut s, &mut e)
            .into_iter()
            .filter(|m| m["t"] == "rows" && m["sub"] == "feed")
        {
            rows = m["rows"].as_array().expect("rows").clone();
            bottom = m["atBottom"] == true;
        }
        if bottom {
            break;
        }
    }
    assert!(
        paged,
        "notification cursor advances after main feed exhaustion"
    );
    assert!(bottom, "short final page exhausts both sources");
    assert_eq!(rows.len(), 8);
    assert!(rows.iter().all(|r| r["kind"] == "notification"));
    assert!(
        rows.windows(2)
            .all(|r| r[0]["at"].as_u64() > r[1]["at"].as_u64())
    );
}

#[test]
fn unresolved_reposts_are_fetched_without_projecting_wrapper_content_as_a_note() {
    let mut e = Engine::new();
    let mut s = Session::default();
    let target = event(10, 1, "rich image https://local.test/a.png", vec![]);
    let wrapper = event(20, 6, "", vec![vec!["e".into(), target.id.clone()]]);
    e.store.insert(wrapper, None);
    e.input(
        Input::Configure {
            relays: vec![RELAY.into()],
        },
        0,
    );
    accept(
        &mut s,
        &mut e,
        json!({"t":"open","sub":"feed","query":{"source":"global","text":"rich","has":["image"]}}),
        0,
    );
    assert!(
        output(&mut s, &mut e)
            .iter()
            .filter(|m| m["t"] == "rows")
            .all(|m| m["rows"] == json!([]))
    );
    e.network.connected(RELAY, 1);
    let mut requested = false;
    for now in (100..=1000).step_by(100) {
        for f in frames(&mut e).into_iter().filter(|f| f[0] == "REQ") {
            requested |= f[2]["ids"]
                .as_array()
                .is_some_and(|ids| ids.contains(&json!(target.id)));
            e.network
                .message(RELAY, &json!(["EOSE", f[1]]).to_string(), now);
        }
        e.tick(now);
    }
    assert!(
        requested,
        "missing filtered repost targets remain in hydration wants"
    );
}

#[test]
fn mixed_fresh_counts_grouped_rows_instead_of_reaction_events() {
    let mut e = Engine::new();
    let mut s = Session::default();
    let post = event(10, 1, "post", vec![]);
    e.store.insert(post.clone(), None);
    for at in [20, 30] {
        e.store.insert(
            event(
                at,
                7,
                "+",
                vec![
                    vec!["p".into(), post.pubkey.clone()],
                    vec!["e".into(), post.id.clone()],
                ],
            ),
            None,
        );
    }
    accept(
        &mut s,
        &mut e,
        json!({"t":"open","sub":"feed","query":{"source":"global","account":post.pubkey,"notifications":true}}),
        0,
    );
    output(&mut s, &mut e);
    accept(
        &mut s,
        &mut e,
        json!({"t":"window","sub":"feed","anchor":{"key":post.id},"before":0,"after":1}),
        1,
    );
    let messages = output(&mut s, &mut e);
    assert!(
        messages
            .iter()
            .any(|m| m["t"] == "fresh" && m["count"] == 1)
    );
}
