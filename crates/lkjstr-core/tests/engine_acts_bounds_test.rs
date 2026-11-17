mod engine_acts_support;
use engine_acts_support::*;
use lkjstr_core::engine::{Engine, wire::Session};

#[test]
fn four_link_chain_resolves_but_fifth_link_fails_without_a_false_note() -> Test {
    for links in [4, 5] {
        let note = event(1, 10, 1, "bounded terminal", vec![])?;
        let mut chain = vec![note.clone()];
        for index in 1..links {
            let target = chain.last().ok_or("chain root")?;
            chain.push(act(1, 10 + index, 7, "+", target)?);
        }
        let owned = chain.last().ok_or("owned act")?.clone();
        let outer = act(2, 30, 7, "+", &owned)?;
        let mut engine = Engine::new();
        for event in &chain {
            put(&mut engine, &[event]);
        }
        put(&mut engine, &[&outer]);
        let mut session = Session::default();
        open(&mut session, &mut engine, "news", news(&owned.pubkey), 0)?;
        let key = format!("notification:reaction:{}:❤️", owned.id);
        let row = row(&output(&mut session, &mut engine)?, &key)?;
        if links == 4 {
            assert_eq!(row["target"]["id"], note.id);
            assert!(row.get("pendingAct").is_none());
        } else {
            assert!(row.get("target").is_none());
            assert_eq!(row["pendingAct"]["state"], "failed");
        }
    }
    Ok(())
}

#[test]
fn malformed_cycle_and_non_note_terminal_never_become_target_excerpts() -> Test {
    for mode in ["cycle", "malformed", "profile"] {
        let note = event(1, 10, 1, "unused terminal", vec![])?;
        let terminal = event(1, 12, 0, r#"{"name":"not a note"}"#, vec![])?;
        let mut owned = act(
            1,
            20,
            7,
            "+",
            if mode == "profile" { &terminal } else { &note },
        )?;
        if mode == "cycle" {
            // Defensive pure-store fixture: the wire verifier independently rejects forged cycles.
            owned.tags[0][1] = owned.id.clone();
        } else if mode == "malformed" {
            owned.tags[0][1] = "not-an-event-id".into();
        }
        let outer = act(2, 30, 7, "+", &owned)?;
        let mut engine = Engine::new();
        put(&mut engine, &[&terminal, &owned, &outer]);
        let mut session = Session::default();
        open(&mut session, &mut engine, "news", news(&owned.pubkey), 0)?;
        let row = row(
            &output(&mut session, &mut engine)?,
            &format!("notification:reaction:{}:❤️", owned.id),
        )?;
        assert!(row.get("target").is_none());
        assert_eq!(row["pendingAct"]["state"], "failed");
    }
    Ok(())
}

#[test]
fn untrusted_zap_target_does_not_invent_an_act_ref_or_render_receipt_json() -> Test {
    let note = event(1, 10, 1, "note", vec![])?;
    let receipt = act(1, 20, 9735, r#"{"receipt":"not note text"}"#, &note)?;
    let outer = act(2, 30, 7, "+", &receipt)?;
    let mut engine = Engine::new();
    put(&mut engine, &[&note, &receipt, &outer]);
    let mut session = Session::default();
    open(&mut session, &mut engine, "news", news(&receipt.pubkey), 0)?;
    let row = row(
        &output(&mut session, &mut engine)?,
        &format!("notification:reaction:{}:❤️", receipt.id),
    )?;
    assert!(row.get("target").is_none());
    assert!(row.get("pendingAct").is_none());
    open(
        &mut session,
        &mut engine,
        "person",
        profile(&outer.pubkey, &outer.pubkey, "reactions"),
        1,
    )?;
    assert!(
        rows(&output(&mut session, &mut engine)?)
            .iter()
            .all(|r| r["kind"] != "note")
    );
    Ok(())
}

#[test]
fn unknown_target_waits_without_ownership_then_wrong_author_corrects_unread() -> Test {
    let note = event(1, 10, 1, "reader note", vec![])?;
    let target = act(3, 20, 7, "+", &note)?;
    let outer = event(
        2,
        30,
        7,
        "+",
        vec![
            vec!["e".into(), target.id.clone()],
            vec!["p".into(), note.pubkey.clone()],
        ],
    )?;
    let mut engine = Engine::new();
    put(&mut engine, &[&note, &outer]);
    engine.seen.insert(note.pubkey.clone(), 20_000);
    let mut session = Session::default();
    open(&mut session, &mut engine, "news", news(&note.pubkey), 0)?;
    let key = format!("notification:reaction:{}:❤️", target.id);
    let initial = row(&output(&mut session, &mut engine)?, &key)?;
    assert!(initial.get("target").is_none());
    assert!(initial.get("pendingAct").is_none());
    assert_eq!(
        lkjstr_core::engine::wire::unread_count(&engine, &note.pubkey),
        1
    );
    engine.enqueue("cache".into(), target);
    engine.tick(100);
    let messages = output(&mut session, &mut engine)?;
    assert!(
        messages
            .iter()
            .filter(|m| m["t"] == "patch")
            .filter_map(|m| m["ops"].as_array())
            .flatten()
            .any(|op| op["op"] == "remove" && op["key"] == key)
    );
    assert_eq!(
        lkjstr_core::engine::wire::unread_count(&engine, &note.pubkey),
        0
    );
    assert_eq!(
        lkjstr_core::engine::wire::notification_watermark(&engine, &note.pubkey).0,
        20_000
    );
    Ok(())
}
