mod engine_acts_support;
use engine_acts_support::*;
use lkjstr_core::engine::{Engine, wire::Session};
use serde_json::json;

#[test]
fn own_reaction_target_resolves_note_and_keeps_act_group_separate() -> Test {
    let note = event(1, 10, 1, "terminal note", vec![])?;
    let owned = event(
        1,
        20,
        7,
        ":star:",
        vec![
            vec!["e".into(), note.id.clone()],
            vec!["p".into(), note.pubkey.clone()],
            vec![
                "emoji".into(),
                "star".into(),
                "https://emoji.test/star.png".into(),
            ],
        ],
    )?;
    let first = act(2, 30, 7, "🎉", &owned)?;
    let second = act(3, 31, 7, "🎉", &owned)?;
    let direct = act(4, 32, 7, "🎉", &note)?;
    let mut engine = Engine::new();
    put(&mut engine, &[&note, &owned, &first, &second, &direct]);
    let mut session = Session::default();
    open(&mut session, &mut engine, "news", news(&note.pubkey), 0)?;
    let messages = output(&mut session, &mut engine)?;
    let rows = rows(&messages);
    assert_eq!(rows.len(), 2);
    let key = format!("notification:reaction:{}:🎉", owned.id);
    let row = row(&messages, &key)?;
    assert_eq!(row["actors"].as_array().map(Vec::len), Some(2));
    assert_eq!(row["target"]["id"], note.id);
    assert_eq!(row["target"]["excerpt"], "terminal note");
    assert_eq!(row["target"]["act"]["type"], "reaction");
    assert_eq!(row["target"]["act"]["actor"]["pubkey"], owned.pubkey);
    assert_eq!(row["target"]["act"]["emoji"]["emoji"], ":star:");
    assert_eq!(
        row["target"]["act"]["emoji"]["url"],
        "https://emoji.test/star.png"
    );
    assert!(row.get("pendingAct").is_none());
    assert!(
        rows.iter()
            .any(|r| r["key"] == format!("notification:reaction:{}:🎉", note.id))
    );
    Ok(())
}

#[test]
fn own_repost_target_and_newest_type_control_notification_projection() -> Test {
    for kind in [6, 16] {
        let note = event(1, 10, 1, "reposted terminal", vec![])?;
        let owned = act(1, 20, kind, "", &note)?;
        let outer = act(2, 30, 16, "", &owned)?;
        let excluded = act(3, 31, 7, "+", &owned)?;
        let mut engine = Engine::new();
        put(&mut engine, &[&note, &owned, &outer, &excluded]);
        let mut session = Session::default();
        let mut query = news(&note.pubkey);
        query["types"] = json!(["repost"]);
        open(&mut session, &mut engine, "news", query, 0)?;
        let messages = output(&mut session, &mut engine)?;
        let rows = rows(&messages);
        assert_eq!(rows.len(), 1);
        let row = &rows[0];
        assert_eq!(row["type"], "repost");
        assert_eq!(row["key"], format!("notification:repost:{}:", owned.id));
        assert_eq!(row["target"]["id"], note.id);
        assert_eq!(row["target"]["act"]["type"], "repost");
        assert!(row["target"]["act"].get("emoji").is_none());
    }
    Ok(())
}

#[test]
fn copied_ancestor_person_tag_does_not_claim_another_persons_act() -> Test {
    let note = event(1, 10, 1, "reader's note", vec![])?;
    let other = act(3, 20, 7, "+", &note)?;
    let outer = event(
        2,
        30,
        7,
        "+",
        vec![
            vec!["e".into(), other.id.clone()],
            vec!["p".into(), other.pubkey.clone()],
            vec!["p".into(), note.pubkey.clone()],
        ],
    )?;
    let mut engine = Engine::new();
    put(&mut engine, &[&note, &other, &outer]);
    let mut session = Session::default();
    open(&mut session, &mut engine, "news", news(&note.pubkey), 0)?;
    let rows = rows(&output(&mut session, &mut engine)?);
    assert!(
        rows.iter()
            .all(|row| row["key"] != format!("notification:reaction:{}:❤️", other.id))
    );
    assert_eq!(
        lkjstr_core::engine::wire::unread_count(&engine, &note.pubkey),
        1
    );
    Ok(())
}

#[test]
fn act_on_act_does_not_change_terminal_counts_chips_or_own_repost() -> Test {
    let note = event(4, 10, 1, "final", vec![])?;
    let owned = act(1, 20, 7, "+", &note)?;
    let reaction = event(
        2,
        30,
        7,
        "⭐",
        vec![
            vec!["e".into(), note.id.clone()],
            vec!["e".into(), owned.id.clone()],
            vec!["p".into(), owned.pubkey.clone()],
        ],
    )?;
    let repost = event(
        2,
        31,
        6,
        "",
        vec![
            vec!["e".into(), note.id.clone()],
            vec!["e".into(), owned.id.clone()],
            vec!["p".into(), owned.pubkey.clone()],
        ],
    )?;
    let mut engine = Engine::new();
    put(&mut engine, &[&note, &owned]);
    let before = lkjstr_core::engine::rows::row(&engine.store, &note, Some(&reaction.pubkey), 0);
    put(&mut engine, &[&reaction, &repost]);
    let after = lkjstr_core::engine::rows::row(&engine.store, &note, Some(&reaction.pubkey), 0);
    assert_eq!(after.counts, before.counts);
    assert_eq!(after.reactions, before.reactions);
    assert_eq!(after.own.reposted, before.own.reposted);
    assert_eq!(after.reposts, before.reposts);
    assert_eq!(engine.store.counts(&owned.id), (0, 1, 1));
    Ok(())
}
