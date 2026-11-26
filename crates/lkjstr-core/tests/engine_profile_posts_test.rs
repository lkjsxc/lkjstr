mod engine_acts_support;
use engine_acts_support::*;
use lkjstr_core::engine::{Engine, query, wire::Session};
use lkjstr_protocol::NostrEvent;
use serde_json::{Value, json};

fn notes(messages: &[Value]) -> Vec<Value> {
    rows(messages)
        .into_iter()
        .filter(|row| row["kind"] == "note")
        .collect()
}

fn ids(notes: &[Value]) -> Vec<&str> {
    notes.iter().filter_map(|row| row["id"].as_str()).collect()
}

fn reposted(row: &Value, original: &NostrEvent, repost: &NostrEvent) {
    assert_eq!(row["key"], original.id);
    assert_eq!(row["author"]["pubkey"], original.pubkey);
    assert_eq!(row["at"], original.created_at * 1000);
    assert_eq!(row["repostedBy"]["at"], repost.created_at * 1000);
    assert_eq!(row["repostedBy"]["actors"][0]["pubkey"], repost.pubkey);
    assert_eq!(
        row["repostedBy"]["actors"].as_array().map(Vec::len),
        Some(1)
    );
    assert!(row.get("act").is_none());
    assert!(row.get("readingAt").is_none());
}

#[test]
fn profile_posts_uses_authored_events_and_the_profiles_own_repost_placements() -> Test {
    let original = event(1, 10, 1, "original", vec![])?;
    let article = event(1, 11, 30023, "article", vec![vec!["d".into(), "a".into()]])?;
    let own = event(2, 40, 1, "authored", vec![])?;
    let reply = event(
        2,
        55,
        1,
        "reply",
        vec![vec![
            "e".into(),
            original.id.clone(),
            "".into(),
            "reply".into(),
        ]],
    )?;
    let regular = act(2, 50, 6, "", &original)?;
    let generic = act(2, 30, 16, "", &article)?;
    let duplicate = act(2, 25, 6, "", &original)?;
    let outsider = act(3, 60, 6, "", &own)?;
    let outsider2 = act(3, 70, 6, "", &original)?;
    let mut engine = Engine::new();
    put(
        &mut engine,
        &[
            &original, &article, &own, &reply, &regular, &generic, &duplicate, &outsider,
            &outsider2,
        ],
    );

    let base = profile(&own.pubkey, &own.pubkey, "posts");
    for (fields, kinds, expected) in [
        (
            json!({}),
            vec![1, 6, 16],
            vec![&original.id, &own.id, &article.id],
        ),
        (json!({"reposts":false}), vec![1], vec![&own.id]),
        (
            json!({"since":20_000,"until":55_000}),
            vec![1, 6, 16],
            vec![&original.id, &own.id, &article.id],
        ),
    ] {
        let mut wire = base.clone();
        wire.as_object_mut()
            .ok_or("profile query")?
            .extend(fields.as_object().ok_or("filter fields")?.clone());
        let converted =
            serde_json::from_value::<lkjstr_core::engine::wire::queries::Query>(wire.clone())?
                .convert()
                .ok_or("converted query")?;
        assert_eq!(query::filter(&engine.store, &converted).kinds, Some(kinds));
        let mut session = Session::default();
        open(&mut session, &mut engine, "person", wire, 65_000)?;
        let shown = notes(&output(&mut session, &mut engine)?);
        assert_eq!(ids(&shown), expected);
        assert!(
            shown
                .iter()
                .find(|row| row["id"] == own.id)
                .ok_or("own note")?
                .get("repostedBy")
                .is_none()
        );
        if shown.len() == 3 {
            reposted(&shown[0], &original, &regular);
            reposted(&shown[2], &article, &generic);
            assert_eq!(shown[2]["eventKind"], 30023);
            let mut timeline = None;
            for now in [66_000, 66_125, 66_250] {
                for frame in session.timeline_tick(&engine, now) {
                    let frame = serde_json::to_value(frame)?;
                    timeline = Some(frame["timeline"].clone());
                }
            }
            let timeline = timeline.ok_or("posts time rail")?;
            assert_eq!(timeline["supported"], true);
            assert_eq!(timeline["months"][0]["count"], 3);
            assert_eq!(timeline["positions"][0]["at"], 50_000);
            assert_eq!(timeline["positions"][2]["at"], 30_000);
            input(
                &mut session,
                &mut engine,
                json!({"t":"window","sub":"person","anchor":{"month":timeline["months"][0]["at"],"offset":2},"before":0,"after":1}),
                67_000,
            )?;
            assert_eq!(
                ids(&notes(&output(&mut session, &mut engine)?)),
                [&article.id]
            );
        }
        input(
            &mut session,
            &mut engine,
            json!({"t":"close","sub":"person"}),
            68_000,
        )?;
        output(&mut session, &mut engine)?;
    }
    Ok(())
}

#[test]
fn profile_posts_hydrates_missing_target_and_inserts_it_at_the_repost_time() -> Test {
    let original = event(1, 10, 1, "late target", vec![])?;
    let own = event(2, 20, 1, "authored", vec![])?;
    let repost = act(2, 30, 6, "", &original)?;
    let mut engine = Engine::new();
    put(&mut engine, &[&own, &repost]);
    let mut session = Session::default();
    open(
        &mut session,
        &mut engine,
        "person",
        profile(&own.pubkey, &own.pubkey, "posts"),
        35_000,
    )?;
    assert_eq!(ids(&notes(&output(&mut session, &mut engine)?)), [&own.id]);
    engine.enqueue("cache".into(), original.clone());
    engine.tick(36_000);
    let messages = output(&mut session, &mut engine)?;
    let inserted = messages
        .iter()
        .filter(|frame| frame["t"] == "patch" && frame["sub"] == "person")
        .filter_map(|frame| frame["ops"].as_array())
        .flatten()
        .filter_map(|op| op["rows"].as_array())
        .flatten()
        .find(|row| row["id"] == original.id)
        .ok_or("repost patch")?;
    reposted(inserted, &original, &repost);
    Ok(())
}
