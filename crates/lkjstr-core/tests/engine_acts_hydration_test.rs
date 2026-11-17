mod engine_acts_support;
use engine_acts_support::*;
use lkjstr_core::engine::{
    Engine,
    network::Effect,
    protocol::{Input, Query},
    wire::Session,
};
use lkjstr_protocol::NostrFilter;
use serde_json::{Value, json};
#[test]
fn known_own_act_keeps_group_identity_when_terminal_note_arrives() -> Test {
    let note = event(3, 10, 1, "late terminal", vec![])?;
    let own = act(1, 20, 7, "⭐", &note)?;
    let outer = act(2, 30, 7, "+", &own)?;
    let mut engine = Engine::new();
    put(&mut engine, &[&own, &outer]);
    let mut session = Session::default();
    open(&mut session, &mut engine, "news", news(&own.pubkey), 0)?;
    let key = format!("notification:reaction:{}:❤️", own.id);
    let initial = row(&output(&mut session, &mut engine)?, &key)?;
    assert!(initial.get("target").is_none());
    assert_eq!(initial["pendingAct"]["state"], "loading");
    assert_eq!(initial["pendingAct"]["act"]["actor"]["pubkey"], own.pubkey);
    engine.enqueue("cache".into(), note.clone());
    engine.tick(100);
    let updated = row(&output(&mut session, &mut engine)?, &key)?;
    assert_eq!(updated["key"], initial["key"]);
    assert_eq!(updated["target"]["id"], note.id);
    assert_eq!(updated["target"]["act"]["emoji"]["emoji"], "⭐");
    assert!(updated.get("pendingAct").is_none());
    Ok(())
}

#[test]
fn finite_act_lookup_distinguishes_missing_failure_and_unverified_or_full_answers() -> Test {
    for mode in ["empty", "closed", "deadline", "full", "verifying"] {
        let note = event(3, 10, 1, "absent from Store", vec![])?;
        let own = act(1, 20, 7, "+", &note)?;
        let outer = act(2, 30, 7, "+", &own)?;
        let mut engine = Engine::new();
        put(&mut engine, &[&own, &outer]);
        let mut session = Session::default();
        open(&mut session, &mut engine, "news", news(&own.pubkey), 0)?;
        let key = format!("notification:reaction:{}:❤️", own.id);
        let initial = row(&output(&mut session, &mut engine)?, &key)?;
        engine.network.configure(vec![RELAY.into()], 0);
        engine.network.plan(
            vec![(
                "news".into(),
                NostrFilter {
                    ids: Some(vec![note.id.clone()]),
                    limit: Some(1),
                    ..Default::default()
                },
                Query::default(),
            )],
            &engine.store,
            0,
        );
        engine.network.connected(RELAY, 1);
        let wire = request(&mut engine, |f| {
            f["ids"]
                .as_array()
                .is_some_and(|ids| ids.iter().any(|id| id == &note.id))
        })?;
        if mode == "full" {
            // Raw matching receipt without verified Store admission cannot prove absence.
            let event =
                engine
                    .network
                    .message(RELAY, &json!(["EVENT", wire, note]).to_string(), 11_000);
            assert!(
                event.is_some(),
                "the full-page premise requires a matching wire receipt"
            );
        }
        if mode == "deadline" {
            engine.network.tick(31_000);
        } else {
            let frame = if mode == "closed" {
                json!(["CLOSED", wire, "error: fixture"])
            } else {
                json!(["EOSE", wire])
            };
            engine.network.message(RELAY, &frame.to_string(), 11_001);
        }
        if mode == "verifying" {
            engine.enqueue("cache".into(), event(9, 1, 1, "queued", vec![])?);
        }
        let messages = status(&mut session, &engine)?;
        assert!(
            messages
                .iter()
                .any(|m| m["t"] == "state" && m["sub"] == "news")
        );
        let updated = row(&messages, &key).unwrap_or(initial);
        let expected = match mode {
            "empty" => "missing",
            "verifying" => "loading",
            _ => "failed",
        };
        assert_eq!(updated["pendingAct"]["state"], expected, "{mode}");
        assert!(updated.get("target").is_none(), "{mode}");
    }
    Ok(())
}

#[test]
fn deep_missing_link_is_owned_by_visible_view_and_released_on_hide_and_close() -> Test {
    let note = event(5, 10, 1, "four-edge terminal", vec![])?;
    let third = act(4, 11, 7, "+", &note)?;
    let second = act(3, 12, 7, "+", &third)?;
    let own = act(1, 13, 7, "+", &second)?;
    let outer = act(2, 14, 7, "+", &own)?;
    let mut engine = Engine::new();
    put(&mut engine, &[&third, &second, &own, &outer]);
    engine.input(
        Input::Configure {
            relays: vec![RELAY.into()],
        },
        0,
    );
    let mut session = Session::default();
    open(&mut session, &mut engine, "news", news(&own.pubkey), 1)?;
    engine.network.connected(RELAY, 2);
    let wire = request(&mut engine, |f| {
        f["ids"]
            .as_array()
            .is_some_and(|ids| ids.iter().any(|id| id == &note.id))
    })?;
    engine.input(
        Input::Hint {
            visible_subs: vec![],
            focused_sub: None,
            page_hidden: true,
            idle: false,
            save_data: false,
        },
        11_000,
    );
    let effects = engine.network.drain_effects();
    assert!(
        effects.iter().any(|effect| match effect {
            Effect::Disconnect(url) => url == RELAY,
            Effect::Send(_, text) => serde_json::from_str::<Value>(text)
                .is_ok_and(|frame| frame[0] == "CLOSE" && frame[1] == wire),
            _ => false,
        }),
        "hidden view releases its missing-link request"
    );
    engine.input(
        Input::Hint {
            visible_subs: vec!["news".into()],
            focused_sub: Some("news".into()),
            page_hidden: false,
            idle: false,
            save_data: false,
        },
        11_001,
    );
    engine.network.connected(RELAY, 11_002);
    engine.network.drain_effects(); // Inputs before close may have legitimately begun new work.
    engine.input(Input::Close { sub: "news".into() }, 11_003);
    engine.network.tick(12_000);
    assert!(
        frame_requests(&mut engine)?.is_empty(),
        "closed view admits no later chain work"
    );
    Ok(())
}

#[test]
fn late_profile_metadata_updates_both_act_actors_without_changing_note_key() -> Test {
    let note = event(5, 10, 1, "terminal", vec![])?;
    let inner = act(3, 20, 7, "+", &note)?;
    let outer = act(2, 30, 7, "⭐", &inner)?;
    let inner_profile = event(
        3,
        40,
        0,
        r#"{"name":"inner","picture":"https://picture.test/inner.png"}"#,
        vec![],
    )?;
    let outer_profile = event(2, 40, 0, r#"{"name":"outer"}"#, vec![])?;
    let mut engine = Engine::new();
    put(&mut engine, &[&note, &inner, &outer]);
    engine.input(
        Input::Configure {
            relays: vec![RELAY.into()],
        },
        0,
    );
    let mut session = Session::default();
    open(
        &mut session,
        &mut engine,
        "person",
        profile(&outer.pubkey, &outer.pubkey, "reactions"),
        1,
    )?;
    engine.network.connected(RELAY, 2);
    let initial = row(&output(&mut session, &mut engine)?, &note.id)?;
    request(&mut engine, |f| {
        f["kinds"] == json!([0])
            && f["authors"].as_array().is_some_and(|authors| {
                authors.iter().any(|p| p == &inner.pubkey)
                    && authors.iter().any(|p| p == &outer.pubkey)
            })
    })?;
    engine.enqueue("cache".into(), inner_profile);
    engine.enqueue("cache".into(), outer_profile);
    engine.tick(11_000);
    let updated = row(&output(&mut session, &mut engine)?, &note.id)?;
    assert_eq!(updated["key"], initial["key"]);
    assert_eq!(updated["act"]["actor"]["name"], "outer");
    assert_eq!(updated["actOn"]["actor"]["name"], "inner");
    assert_eq!(
        updated["actOn"]["actor"]["picture"],
        "https://picture.test/inner.png"
    );
    Ok(())
}
