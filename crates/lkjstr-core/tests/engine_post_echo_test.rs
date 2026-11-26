#![allow(clippy::expect_used)]
mod engine_review_support;

use engine_review_support::{RELAY, accept, output};
use lkjstr_core::engine::{Engine, wire::Session};
use lkjstr_protocol::{EventTemplate, UnsignedNostrEvent, finalize_event, generate_secret_key};
use serde_json::{Value, json};

fn row<'a>(outputs: &'a [Value], sub: &str, id: &str) -> &'a Value {
    outputs
        .iter()
        .filter(|message| message["sub"] == sub)
        .find_map(|message| {
            message["rows"]
                .as_array()
                .into_iter()
                .flatten()
                .chain(
                    message["ops"]
                        .as_array()
                        .into_iter()
                        .flatten()
                        .flat_map(|op| {
                            op["rows"]
                                .as_array()
                                .into_iter()
                                .flatten()
                                .chain(op.get("row"))
                        }),
                )
                .find(|row| row["id"] == id)
        })
        .expect("projected note")
}

#[test]
fn signed_reply_renders_before_any_relay_answer_and_confirms_in_place() {
    let key = generate_secret_key();
    let root = finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: 1,
            kind: 1,
            tags: vec![],
            content: "Thread root".into(),
        },
        &key,
    )
    .expect("root");
    let owner = &root.pubkey;
    let mut engine = Engine::new();
    let mut session = Session::default();
    engine.network.configure(vec![RELAY.into()], 2000);
    engine.store.insert(root.clone(), None);
    for (sub, query) in [
        ("home", json!({"source":"home","account":owner})),
        ("held", json!({"source":"home","account":owner})),
        (
            "profile",
            json!({"source":"profile","account":owner,"pubkey":owner}),
        ),
        (
            "thread",
            json!({"source":"thread","account":owner,"id":root.id}),
        ),
    ] {
        accept(
            &mut session,
            &mut engine,
            json!({"t":"open","sub":sub,"query":query}),
            2000,
        );
    }
    accept(
        &mut session,
        &mut engine,
        json!({"t":"window","sub":"held","anchor":{"key":root.id},"before":0,"after":10}),
        2000,
    );
    output(&mut session, &mut engine);
    accept(
        &mut session,
        &mut engine,
        json!({"t":"act","req":"post","action":{"a":"publish","as":owner,
            "what":{"k":"note","draft":{"text":"New signed reply","replyTo":root.id}}}}),
        2000,
    );
    let sign = output(&mut session, &mut engine);
    let template: UnsignedNostrEvent =
        serde_json::from_str(sign[0]["event"].as_str().expect("signing request"))
            .expect("template");
    let note = finalize_event(
        &EventTemplate {
            pubkey: Some(template.pubkey),
            created_at: template.created_at,
            kind: template.kind,
            tags: template.tags,
            content: template.content,
        },
        &key,
    )
    .expect("reply");
    accept(
        &mut session,
        &mut engine,
        json!({"t":"signed","req":"post","event":serde_json::to_string(&note).expect("signed JSON")}),
        2001,
    );
    // No tick, ready socket, subscription response, EVENT echo or OK.
    let signed = output(&mut session, &mut engine);
    assert_eq!(
        signed[0],
        json!({"t":"publish.signed","req":"post","id":note.id})
    );
    for sub in ["home", "profile", "thread"] {
        assert_eq!(row(&signed, sub, &note.id)["pending"], true, "{sub}");
    }
    assert!(signed.iter().any(|m| m["t"] == "fresh"
        && m["sub"] == "held"
        && m["count"] == 1
        && m["ownHead"] == true));
    assert!(
        signed
            .iter()
            .filter(|m| m["sub"] == "held")
            .all(|m| m["t"] != "rows")
    );
    assert_eq!(row(&signed, "thread", &note.id)["thread"]["role"], "reply");
    assert!(signed.iter().any(|m| m["sub"] == "home"
        && (m["rows"][0]["id"] == note.id
            || m["ops"].as_array().into_iter().flatten().any(|op| {
                op["op"] == "insert"
                    && (op["before"].is_null() || op["before"] == root.id)
                    && op["rows"][0]["id"] == note.id
            }))));

    engine.network.connected(RELAY, 2002);
    engine
        .network
        .message(RELAY, &json!(["OK", note.id, true, ""]).to_string(), 2003);
    engine.enqueue(RELAY.into(), note.clone());
    engine.tick(2100);
    let confirmed = output(&mut session, &mut engine);
    assert_eq!(engine.store.get(&note.id).as_deref(), Some(&note));
    assert_eq!(engine.store.len(), 2);
    assert!(
        confirmed
            .iter()
            .any(|m| m["t"] == "result" && m["req"] == "post" && m["ok"] == true)
    );
    for sub in ["home", "profile", "thread"] {
        assert!(row(&confirmed, sub, &note.id)["pending"].is_null(), "{sub}");
        assert!(
            confirmed.iter().filter(|m| m["sub"] == sub).all(|m| {
                m["ops"].as_array().into_iter().flatten().all(|op| {
                    op["key"] != note.id
                        && op["rows"]
                            .as_array()
                            .into_iter()
                            .flatten()
                            .all(|r| r["id"] != note.id)
                })
            }),
            "{sub} reinserted or removed the note"
        );
    }
}
