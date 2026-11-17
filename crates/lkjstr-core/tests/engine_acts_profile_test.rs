mod engine_acts_support;
use engine_acts_support::*;
use lkjstr_core::engine::{Engine, protocol::Input, wire::Session};
use serde_json::json;

#[test]
fn profile_chain_renders_terminal_note_with_both_actual_act_chips() -> Test {
    for (show, outer_kind) in [("reactions", 7), ("reposts", 16)] {
        for inner_kind in [7, 6, 16] {
            let note = event(1, 10, 1, "end of chain", vec![])?;
            let inner = act(3, 20, inner_kind, "+", &note)?;
            let outer = event(
                2,
                30,
                outer_kind,
                ":smile:",
                vec![
                    vec!["e".into(), inner.id.clone()],
                    vec!["p".into(), inner.pubkey.clone()],
                    vec![
                        "emoji".into(),
                        "smile".into(),
                        "https://emoji.test/smile.png".into(),
                    ],
                ],
            )?;
            let mut engine = Engine::new();
            put(&mut engine, &[&note, &inner, &outer]);
            let mut session = Session::default();
            open(
                &mut session,
                &mut engine,
                "person",
                profile(&outer.pubkey, &outer.pubkey, show),
                0,
            )?;
            let messages = output(&mut session, &mut engine)?;
            let notes = rows(&messages)
                .into_iter()
                .filter(|r| r["kind"] == "note")
                .collect::<Vec<_>>();
            assert_eq!(notes.len(), 1);
            let row = &notes[0];
            assert_eq!(row["key"], note.id);
            assert_eq!(row["id"], note.id);
            assert_eq!(row["author"]["pubkey"], note.pubkey);
            assert_eq!(row["segments"][0]["text"], "end of chain");
            assert_eq!(row["at"], 30_000);
            assert_eq!(row["act"]["actor"]["pubkey"], outer.pubkey);
            assert_eq!(row["actOn"]["actor"]["pubkey"], inner.pubkey);
            assert_eq!(
                row["actOn"]["type"],
                if inner_kind == 7 {
                    "reaction"
                } else {
                    "repost"
                }
            );
            if outer_kind == 7 {
                assert_eq!(row["act"]["emoji"]["emoji"], ":smile:");
                assert_eq!(row["act"]["emoji"]["url"], "https://emoji.test/smile.png");
            } else {
                assert_eq!(row["act"]["type"], "repost");
                assert_eq!(row["repostedBy"]["at"], 30_000);
            }
        }
    }
    Ok(())
}

#[test]
fn profile_dedupe_uses_one_indirect_event_for_context_time_and_order() -> Test {
    for (direct_at, indirect_at) in [(40, 20), (20, 40)] {
        let note = event(1, 10, 1, "shared terminal", vec![])?;
        let other_note = event(1, 11, 1, "other terminal", vec![])?;
        let inner = act(3, 15, 7, "+", &note)?;
        let direct = act(2, direct_at, 7, "🔥", &note)?;
        let indirect = act(2, indirect_at, 7, "⭐", &inner)?;
        let other = act(2, 30, 7, "+", &other_note)?;
        let mut engine = Engine::new();
        put(
            &mut engine,
            &[&note, &other_note, &inner, &direct, &indirect, &other],
        );
        let mut session = Session::default();
        open(
            &mut session,
            &mut engine,
            "person",
            profile(&direct.pubkey, &direct.pubkey, "reactions"),
            0,
        )?;
        let messages = output(&mut session, &mut engine)?;
        let notes = rows(&messages)
            .into_iter()
            .filter(|r| r["kind"] == "note")
            .collect::<Vec<_>>();
        assert_eq!(notes.len(), 2);
        let projected = row(&messages, &note.id)?;
        assert_eq!(projected["act"]["emoji"]["emoji"], "⭐");
        assert_eq!(projected["actOn"]["actor"]["pubkey"], inner.pubkey);
        assert_eq!(projected["at"], indirect_at * 1000);
        assert_eq!(
            notes[0]["id"],
            if indirect_at > 30 {
                note.id.as_str()
            } else {
                other_note.id.as_str()
            }
        );
        assert_eq!(projected["counts"]["reactions"], 2);
    }
    Ok(())
}

#[test]
fn profile_ties_anchor_and_time_rail_follow_the_selected_act() -> Test {
    let note = event(1, 10, 1, "anchored terminal", vec![])?;
    let second_note = event(1, 11, 1, "second terminal", vec![])?;
    let inner = act(3, 15, 7, "+", &note)?;
    let first = act(2, 40, 7, "⭐", &inner)?;
    let second = act(2, 40, 7, "🔥", &inner)?;
    let chosen = if first.id > second.id {
        &first
    } else {
        &second
    };
    let direct = act(2, 50, 7, "+", &note)?;
    let other = act(2, 30, 7, "+", &second_note)?;
    let mut engine = Engine::new();
    put(
        &mut engine,
        &[
            &note,
            &second_note,
            &inner,
            &first,
            &second,
            &direct,
            &other,
        ],
    );
    let mut session = Session::default();
    open(
        &mut session,
        &mut engine,
        "person",
        profile(&direct.pubkey, &direct.pubkey, "reactions"),
        0,
    )?;
    let projected = row(&output(&mut session, &mut engine)?, &note.id)?;
    assert_eq!(projected["act"]["emoji"]["emoji"], chosen.content);
    assert_eq!(projected["at"], 40_000);
    input(
        &mut session,
        &mut engine,
        json!({"t":"window","sub":"person","anchor":{"key":note.id},"before":0,"after":1}),
        1,
    )?;
    let held = rows(&output(&mut session, &mut engine)?);
    assert_eq!(held.iter().filter(|r| r["kind"] == "note").count(), 1);
    assert!(
        held.iter()
            .any(|r| r["kind"] == "note" && r["id"] == note.id)
    );
    let timeline = session
        .timeline_tick(&engine, 1000)
        .into_iter()
        .map(serde_json::to_value)
        .collect::<Result<Vec<_>, _>>()?;
    assert!(
        timeline
            .iter()
            .any(|m| m["sub"] == "person" && m["timeline"]["supported"] == false)
    );
    engine.input(
        Input::Close {
            sub: "person".into(),
        },
        2,
    );
    Ok(())
}

#[test]
fn profile_chain_expansion_does_not_add_home_or_search_membership() -> Test {
    let note = event(1, 10, 1, "terminal", vec![])?;
    let inner = act(3, 15, 7, "+", &note)?;
    let outer = act(2, 20, 7, "+", &inner)?;
    let mut engine = Engine::new();
    put(&mut engine, &[&note, &inner]);
    let query = lkjstr_core::engine::protocol::Query {
        source: lkjstr_core::engine::protocol::Source::Home,
        account: Some(outer.pubkey.clone()),
        ..Default::default()
    };
    let before = lkjstr_core::engine::query::events(&engine.store, &query);
    put(&mut engine, &[&outer]);
    assert_eq!(
        lkjstr_core::engine::query::events(&engine.store, &query),
        before
    );
    let search = lkjstr_core::engine::protocol::Query {
        source: lkjstr_core::engine::protocol::Source::Search,
        ..Default::default()
    };
    assert_eq!(
        lkjstr_core::engine::query::events(&engine.store, &search)
            .iter()
            .map(|e| &e.id)
            .collect::<Vec<_>>(),
        vec![&note.id]
    );
    Ok(())
}
