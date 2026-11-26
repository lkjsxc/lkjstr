mod engine_acts_support;
use engine_acts_support::*;
use lkjstr_core::engine::{Engine, wire::Session};
use lkjstr_protocol::NostrEvent;
use serde_json::{Value, json};

fn fixture() -> Test<(Engine, NostrEvent, NostrEvent)> {
    let note = event(1, 10, 1, "original", vec![])?;
    let own = act(1, 30, 6, "", &note)?;
    let other = act(2, 40, 6, "", &note)?;
    let mut engine = Engine::new();
    put(&mut engine, &[&note, &own, &other]);
    Ok((engine, note, own))
}

fn apply(state: &mut Vec<Value>, messages: &[Value]) -> Test {
    for message in messages.iter().filter(|m| m["sub"] == "person") {
        if message["t"] == "rows" {
            *state = message["rows"].as_array().ok_or("rows array")?.clone();
        } else if message["t"] == "patch" {
            for op in message["ops"].as_array().ok_or("patch array")? {
                match op["op"].as_str().ok_or("patch kind")? {
                    "remove" => state.retain(|row| row["key"] != op["key"]),
                    "update" => {
                        let row = state
                            .iter_mut()
                            .find(|row| row["key"] == op["row"]["key"])
                            .ok_or("updated row exists")?;
                        *row = op["row"].clone();
                    }
                    "insert" => {
                        let at = if op["before"].is_null() {
                            state.len()
                        } else {
                            state
                                .iter()
                                .position(|row| row["key"] == op["before"])
                                .ok_or("insert anchor exists")?
                        };
                        state.splice(at..at, op["rows"].as_array().ok_or("insert rows")?.clone());
                    }
                    _ => return Err("unexpected patch operation".into()),
                }
            }
        }
    }
    Ok(())
}

fn authored(state: &[Value], expected: &[&NostrEvent]) -> Test {
    let notes = state
        .iter()
        .filter(|row| row["kind"] == "note")
        .collect::<Vec<_>>();
    assert_eq!(notes.len(), expected.len(), "one row per authored event");
    for (row, event) in notes.iter().zip(expected) {
        assert_eq!(row["id"], event.id);
        assert_eq!(row["key"], event.id);
        assert_eq!(row["at"], event.created_at * 1000);
        assert!(
            row.get("repostedBy").is_none(),
            "All must not add repost context: {row}"
        );
    }
    for row in notes {
        assert!(
            row.get("readingAt").is_none(),
            "ordinary All remains snapshot-safe"
        );
    }
    Ok(())
}

fn start(engine: &mut Engine, session: &mut Session, query: Value) -> Test<Vec<Value>> {
    open(session, engine, "person", query, 0)?;
    let mut state = vec![];
    apply(&mut state, &output(session, engine)?)?;
    assert!(!state.is_empty(), "initial wire rows");
    Ok(state)
}

#[test]
fn all_initial_rows_use_authored_time_with_and_without_date_filters() -> Test {
    for dated in [false, true] {
        let (mut engine, note, own) = fixture()?;
        let mut query = profile(&note.pubkey, &note.pubkey, "all");
        if dated {
            query["since"] = json!(1_000);
            query["until"] = json!(50_000);
        }
        let mut session = Session::default();
        let state = start(&mut engine, &mut session, query)?;
        authored(&state, &[&own, &note])?;
        let original = state
            .iter()
            .find(|row| row["id"] == note.id)
            .ok_or("original")?;
        assert_eq!(original["counts"]["reposts"], 2);
        assert_eq!(original["mine"]["reposted"], true);
    }
    Ok(())
}

#[test]
fn all_live_reposts_patch_counts_without_wrapping_or_duplicating_authored_rows() -> Test {
    let (mut engine, note, own) = fixture()?;
    let mut session = Session::default();
    let mut state = start(
        &mut engine,
        &mut session,
        profile(&note.pubkey, &note.pubkey, "all"),
    )?;
    let other = act(3, 50, 6, "", &note)?;
    let next_own = act(1, 60, 6, "", &note)?;
    for incoming in [&other, &next_own] {
        engine.enqueue("cache".into(), incoming.clone());
    }
    engine.tick(70_000);
    let messages = output(&mut session, &mut engine)?;
    assert!(
        messages.iter().any(|m| m["t"] == "patch"),
        "live wire patch"
    );
    let update = row(&messages, &note.id)?;
    assert_eq!(update["counts"]["reposts"], 4);
    assert!(
        update.get("repostedBy").is_none(),
        "live original must remain unwrapped"
    );
    apply(&mut state, &messages)?;
    authored(&state, &[&next_own, &own, &note])?;
    Ok(())
}

#[test]
fn all_metadata_patch_does_not_restore_repost_context() -> Test {
    let (mut engine, note, own) = fixture()?;
    let mut session = Session::default();
    let mut state = start(
        &mut engine,
        &mut session,
        profile(&note.pubkey, &note.pubkey, "all"),
    )?;
    let metadata = event(1, 70, 0, r#"{"name":"Updated owner"}"#, vec![])?;
    engine.enqueue("cache".into(), metadata.clone());
    engine.tick(80_000);
    let messages = output(&mut session, &mut engine)?;
    assert!(
        messages.iter().any(|m| m["t"] == "patch"),
        "metadata wire patch"
    );
    assert_eq!(row(&messages, &note.id)?["author"]["name"], "Updated owner");
    apply(&mut state, &messages)?;
    authored(&state, &[&metadata, &own, &note])?;
    Ok(())
}

#[test]
fn all_reveal_reconstruction_and_repeated_windows_keep_authored_time() -> Test {
    let (mut engine, note, own) = fixture()?;
    let mute = event(
        3,
        20,
        10000,
        "",
        vec![vec!["p".into(), note.pubkey.clone()]],
    )?;
    put(&mut engine, &[&mute]);
    let mut session = Session::default();
    let mut state = start(
        &mut engine,
        &mut session,
        profile(&mute.pubkey, &note.pubkey, "all"),
    )?;
    assert_eq!(
        state.iter().find(|r| r["id"] == note.id).ok_or("covered")?["hidden"]["reason"],
        "muted-person"
    );
    let messages = session
        .note_reveal("show".into(), "person", &note.id, true, &engine)
        .into_iter()
        .map(serde_json::to_value)
        .collect::<Result<Vec<_>, _>>()?;
    assert_eq!(
        row(&messages, &note.id)?["revealed"]["reason"],
        "muted-person"
    );
    apply(&mut state, &messages)?;
    authored(&state, &[&own, &note])?;
    input(
        &mut session,
        &mut engine,
        json!({"t":"window","sub":"person","anchor":"top","before":0,"after":20}),
        1,
    )?;
    apply(&mut state, &output(&mut session, &mut engine)?)?;
    authored(&state, &[&own, &note])?;
    Ok(())
}

#[test]
fn home_and_profile_repost_projections_keep_their_attribution() -> Test {
    for mode in ["home", "reposts", "posts"] {
        let (mut engine, note, own) = fixture()?;
        let query = if mode == "home" {
            json!({"source":"home","account":note.pubkey})
        } else {
            profile(&note.pubkey, &note.pubkey, mode)
        };
        let mut session = Session::default();
        let state = start(&mut engine, &mut session, query)?;
        let original = state
            .iter()
            .find(|row| row["id"] == note.id)
            .ok_or("original")?;
        assert!(
            original["repostedBy"].is_object(),
            "{mode} keeps attribution"
        );
        if mode != "home" {
            assert_eq!(original["repostedBy"]["at"], own.created_at * 1000);
            assert_eq!(state.iter().filter(|row| row["kind"] == "note").count(), 1);
        }
    }
    Ok(())
}
