mod engine_acts_support;
use engine_acts_support::*;
use lkjstr_core::engine::{Engine, protocol::Input, wire::Session};
use serde_json::json;

#[test]
fn deleting_a_reaction_can_select_its_image_with_a_shared_shortcode() -> Test {
    let note = event(1, 10, 1, "target", vec![])?;
    let reaction = |key, at, url: Option<&str>| {
        let mut tags = vec![vec!["e".into(), note.id.clone()]];
        if let Some(url) = url {
            tags.push(vec!["emoji".into(), "cat".into(), url.into()]);
        }
        event(key, at, 7, ":cat:", tags)
    };
    let green_url = "https://images.test/green.png";
    let green = reaction(2, 20, Some(green_url))?;
    let blue = reaction(2, 21, Some("https://images.test/blue.png"))?;
    let text = reaction(2, 22, None)?;
    let foreign = reaction(3, 23, Some(green_url))?;
    let mut engine = Engine::new();
    put(&mut engine, &[&note, &green, &blue, &text, &foreign]);
    let mut session = Session::default();
    for (req, url, expected) in [
        ("green", Some(green_url), vec![&green.id]),
        ("text", Some(""), vec![&text.id]),
        ("legacy", None, vec![&green.id, &blue.id, &text.id]),
    ] {
        let mut what = json!({"k":"delete","id":note.id,"of":"reaction","emoji":":cat:"});
        if let Some(url) = url {
            what["url"] = json!(url);
        }
        input(
            &mut session,
            &mut engine,
            json!({"t":"act","req":req,"action":{
            "a":"publish","as":green.pubkey,"what":what}}),
            10_000,
        )?;
        let signed = output(&mut session, &mut engine)?
            .into_iter()
            .find(|message| message["t"] == "sign")
            .ok_or("unsigned deletion")?;
        let deletion: serde_json::Value =
            serde_json::from_str(signed["event"].as_str().ok_or("deletion JSON")?)?;
        let targets: std::collections::BTreeSet<_> = deletion["tags"]
            .as_array()
            .ok_or("deletion tags")?
            .iter()
            .filter(|tag| tag[0] == "e")
            .filter_map(|tag| tag[1].as_str())
            .collect();
        assert_eq!(
            targets,
            expected.into_iter().map(String::as_str).collect(),
            "{req}"
        );
    }
    Ok(())
}

#[test]
fn profile_of_another_person_filters_terminal_text_but_uses_their_act_time() -> Test {
    let note = event(1, 10, 1, "the selected terminal text", vec![])?;
    let inner = act(2, 20, 7, "⭐", &note)?;
    let outer = act(3, 40, 7, "+", &inner)?;
    let reader = event(4, 1, 0, "{}", vec![])?;
    let mut engine = Engine::new();
    put(&mut engine, &[&note, &inner, &outer]);
    let mut session = Session::default();
    let mut query = profile(&reader.pubkey, &outer.pubkey, "reactions");
    query["text"] = json!("selected terminal");
    query["since"] = json!(30_000);
    query["until"] = json!(50_000);
    open(&mut session, &mut engine, "activity", query, 0)?;
    let projected = row(&output(&mut session, &mut engine)?, &note.id)?;
    assert_eq!(projected["at"], 40_000);
    assert_eq!(projected["author"]["pubkey"], note.pubkey);
    assert_eq!(projected["act"]["actor"]["pubkey"], outer.pubkey);
    assert_eq!(projected["actOn"]["actor"]["pubkey"], inner.pubkey);
    Ok(())
}

#[test]
fn malformed_final_e_never_falls_back_to_an_earlier_note_for_counts_or_own_marks() -> Test {
    for last in [
        vec!["e".into()],
        vec!["e".into(), "".into()],
        vec!["e".into(), "bad".into()],
    ] {
        let note = event(1, 10, 1, "not the direct target", vec![])?;
        let reaction = event(
            2,
            20,
            7,
            "+",
            vec![
                vec!["e".into(), note.id.clone()],
                vec!["p".into(), note.pubkey.clone()],
                last.clone(),
            ],
        )?;
        let repost = event(
            2,
            21,
            6,
            "",
            vec![
                vec!["e".into(), note.id.clone()],
                vec!["p".into(), note.pubkey.clone()],
                last,
            ],
        )?;
        let mut engine = Engine::new();
        put(&mut engine, &[&note, &reaction, &repost]);
        let projected =
            lkjstr_core::engine::rows::row(&engine.store, &note, Some(&reaction.pubkey), 0);
        assert_eq!(engine.store.counts(&note.id), (0, 0, 0));
        assert!(projected.reactions.is_empty());
        assert!(projected.reposts.is_empty());
        assert!(!projected.own.reposted);
        let mut session = Session::default();
        open(&mut session, &mut engine, "news", news(&note.pubkey), 0)?;
        let projected = row(
            &output(&mut session, &mut engine)?,
            "notification:reaction::❤️",
        )?;
        assert!(projected.get("target").is_none());
    }
    Ok(())
}

#[test]
fn fifth_edge_is_not_requested_from_an_unshown_self_notification() -> Test {
    let note = event(1, 10, 1, "beyond the bound", vec![])?;
    let fourth = act(1, 11, 7, "+", &note)?;
    let third = act(1, 12, 7, "+", &fourth)?;
    let second = act(1, 13, 7, "+", &third)?;
    let first = act(1, 14, 7, "+", &second)?;
    let outer = act(2, 15, 7, "+", &first)?;
    let mut engine = Engine::new();
    put(&mut engine, &[&fourth, &third, &second, &first, &outer]);
    engine.input(
        Input::Configure {
            relays: vec![RELAY.into()],
        },
        0,
    );
    let mut session = Session::default();
    open(&mut session, &mut engine, "news", news(&first.pubkey), 1)?;
    engine.network.connected(RELAY, 2);
    let mut asked = 0;
    for step in 1..40 {
        engine.network.tick(step * 250);
        for frame in frame_requests(&mut engine)? {
            asked += 1;
            assert!(
                !frame
                    .as_array()
                    .into_iter()
                    .flatten()
                    .skip(2)
                    .any(|filter| filter["ids"]
                        .as_array()
                        .is_some_and(|ids| ids.iter().any(|id| id == &note.id)))
            );
            engine
                .network
                .message(RELAY, &json!(["EOSE", frame[1]]).to_string(), step * 250);
        }
    }
    assert!(asked > 0, "the bound must be exercised on an active relay");
    Ok(())
}

#[test]
fn undoing_a_direct_reaction_keeps_the_readers_reaction_to_an_act() -> Test {
    let note = event(1, 10, 1, "terminal", vec![])?;
    let inner = act(2, 20, 7, "⭐", &note)?;
    let direct = act(3, 30, 7, "+", &note)?;
    let indirect = event(
        3,
        31,
        7,
        "+",
        vec![
            vec!["e".into(), note.id.clone()],
            vec!["e".into(), inner.id.clone()],
        ],
    )?;
    let mut engine = Engine::new();
    put(&mut engine, &[&note, &inner, &direct, &indirect]);
    let mut session = Session::default();
    input(
        &mut session,
        &mut engine,
        json!({"t":"act","req":"undo","action":{
        "a":"publish","as":direct.pubkey,"what":{"k":"delete","id":note.id,
        "of":"reaction","emoji":"❤️"}}}),
        10_000,
    )?;
    let messages = output(&mut session, &mut engine)?;
    let sign = messages
        .iter()
        .find(|message| message["t"] == "sign")
        .ok_or("unsigned deletion")?;
    let event: serde_json::Value =
        serde_json::from_str(sign["event"].as_str().ok_or("deletion JSON")?)?;
    let targets = event["tags"]
        .as_array()
        .ok_or("deletion tags")?
        .iter()
        .filter(|tag| tag[0] == "e")
        .map(|tag| tag[1].clone())
        .collect::<Vec<_>>();
    assert_eq!(targets, vec![json!(direct.id)]);
    assert!(!targets.contains(&json!(indirect.id)));
    Ok(())
}

#[test]
fn untrusted_receipt_link_does_not_suppress_a_valid_direct_activity() -> Test {
    let note = event(1, 10, 1, "visible terminal", vec![])?;
    let receipt = act(1, 20, 9735, "unvalidated receipt", &note)?;
    let direct = act(2, 25, 7, "+", &note)?;
    let indirect = act(2, 30, 7, "⭐", &receipt)?;
    let mut engine = Engine::new();
    put(&mut engine, &[&note, &receipt, &direct, &indirect]);
    let mut session = Session::default();
    open(
        &mut session,
        &mut engine,
        "activity",
        profile(&direct.pubkey, &direct.pubkey, "reactions"),
        0,
    )?;
    let projected = row(&output(&mut session, &mut engine)?, &note.id)?;
    assert_eq!(projected["act"]["emoji"]["emoji"], "❤️");
    assert_eq!(projected["at"], 25_000);
    assert!(projected.get("actOn").is_none());
    Ok(())
}
