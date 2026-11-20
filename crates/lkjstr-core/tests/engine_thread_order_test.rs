use lkjstr_core::engine::{Engine, wire};
use lkjstr_protocol::{
    EventTemplate, NostrEvent, SecretKeyBytes, finalize_event, generate_secret_key,
};
use serde_json::{Value, json};
type TestResult = Result<(), Box<dyn std::error::Error>>;
fn signed(
    key: &SecretKeyBytes,
    at: u64,
    kind: u64,
    text: &str,
    tags: Vec<Vec<String>>,
) -> Result<NostrEvent, Box<dyn std::error::Error>> {
    Ok(finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: at,
            kind,
            content: text.into(),
            tags,
        },
        key,
    )
    .map_err(|_| "fixture signing")?)
}
fn tags(root: &NostrEvent, parent: &NostrEvent) -> Vec<Vec<String>> {
    vec![
        vec!["e".into(), root.id.clone(), "".into(), "root".into()],
        vec!["e".into(), parent.id.clone(), "".into(), "reply".into()],
    ]
}
fn rows(engine: &mut Engine, focus: &str) -> Result<Vec<Value>, Box<dyn std::error::Error>> {
    let mut session = wire::Session::default();
    let input = serde_json::from_value(
        json!({"t":"open","sub":"thread","query":{"source":"thread","id":focus}}),
    )?;
    for input in session.input(input, engine).map_err(|(_, error)| error)? {
        engine.input(input, 100_000);
    }
    let output = engine.drain();
    output
        .into_iter()
        .flat_map(|out| session.output(out, engine))
        .find_map(|out| {
            if let wire::Output::Rows { rows, .. } = out {
                Some(rows)
            } else {
                None
            }
        })
        .ok_or_else(|| "missing rows".into())
}
fn selected(
    key: &SecretKeyBytes,
    name: &str,
    tags: Vec<Vec<String>>,
    choose: impl Fn(&NostrEvent) -> bool,
) -> Result<NostrEvent, Box<dyn std::error::Error>> {
    for i in 0..1024 {
        let event = signed(key, 10, 42, &format!("{name} {i}"), tags.clone())?;
        if choose(&event) {
            return Ok(event);
        }
    }
    Err("fixture ID search exhausted".into())
}
#[test]
fn ancestor_chain_precedes_clock_skewed_focus_with_chronological_replies() -> TestResult {
    let key = generate_secret_key();
    let root = signed(&key, 50, 1, "root", vec![])?;
    let parent = signed(&key, 40, 1, "parent", tags(&root, &root))?;
    let focus = signed(&key, 30, 1, "focus", tags(&root, &parent))?;
    let child = signed(&key, 20, 1, "reply", tags(&root, &focus))?;
    let grandchild = signed(&key, 10, 1, "nested reply", tags(&root, &child))?;
    let mut engine = Engine::new();
    for event in [&grandchild, &focus, &root, &child, &parent] {
        engine.store.insert(event.clone(), None);
    }
    let rows = rows(&mut engine, &focus.id)?;
    assert_eq!(
        rows.iter()
            .filter_map(|r| r["id"].as_str())
            .collect::<Vec<_>>(),
        [&root.id, &parent.id, &focus.id, &grandchild.id, &child.id]
    );
    assert_eq!(rows[3]["thread"]["depth"], 2);
    assert_eq!(rows[4]["thread"]["depth"], 1);
    // Each row names the note it answers, so the interface can group replies and hold room for gaps.
    assert!(rows[0]["thread"].get("parent").is_none());
    assert_eq!(rows[1]["thread"]["parent"], root.id.as_str());
    assert_eq!(rows[2]["thread"]["parent"], parent.id.as_str());
    assert_eq!(rows[3]["thread"]["parent"], child.id.as_str());
    assert_eq!(rows[4]["thread"]["parent"], focus.id.as_str());
    Ok(())
}
#[test]
fn same_second_channel_parents_stay_above_both_low_and_high_id_replies() -> TestResult {
    let key = generate_secret_key();
    let channel = signed(&key, 1, 40, "{}", vec![])?;
    let root_tag = vec![vec![
        "e".into(),
        channel.id.clone(),
        "".into(),
        "root".into(),
    ]];
    // Force a middle-range parent ID so both lexicographic cases are exercised.
    let parent = selected(&key, "parent", root_tag, |e| e.id.starts_with('8'))?;
    let mut replies = Vec::new();
    for low in [true, false] {
        let reply = selected(&key, "reply", tags(&channel, &parent), |e| {
            (e.id < parent.id) == low
        })?;
        replies.push(reply);
    }
    for focus in replies {
        let mut engine = Engine::new();
        for event in [&channel, &parent, &focus] {
            engine.store.insert(event.clone(), None);
        }
        let rows = rows(&mut engine, &focus.id)?;
        assert_eq!(
            rows.iter()
                .filter_map(|r| r["id"].as_str())
                .collect::<Vec<_>>(),
            [&parent.id, &focus.id]
        );
        assert_eq!(rows[0]["thread"]["role"], "ancestor");
    }
    Ok(())
}
#[test]
fn cached_root_across_missing_parent_precedes_focus_despite_clock_skew() -> TestResult {
    let key = generate_secret_key();
    let root = signed(&key, 50, 1, "root", vec![])?;
    let missing = signed(&key, 40, 1, "missing", tags(&root, &root))?;
    let focus = signed(&key, 10, 1, "focus", tags(&root, &missing))?;
    let mut engine = Engine::new();
    for event in [&focus, &root] {
        engine.store.insert(event.clone(), None);
    }
    let rows = rows(&mut engine, &focus.id)?;
    assert_eq!(
        rows.iter()
            .filter_map(|r| r["id"].as_str())
            .collect::<Vec<_>>(),
        [&root.id, &focus.id]
    );
    // The missing parent is still named: the interface shows its room between the root and the focus.
    assert_eq!(rows[1]["thread"]["parent"], missing.id.as_str());
    Ok(())
}

#[test]
fn synthetic_cached_cycle_is_bounded_and_never_duplicates_focus() -> TestResult {
    let key = generate_secret_key();
    let mut a = signed(&key, 20, 1, "first", vec![])?;
    let mut b = signed(&key, 10, 1, "second", vec![])?;
    // Synthetic cache graph, bypassing signature admission to exercise its guard.
    a.tags = tags(&b, &b);
    b.tags = tags(&a, &a);
    let mut engine = Engine::new();
    engine.store.insert(a.clone(), None);
    engine.store.insert(b.clone(), None);
    let projected = rows(&mut engine, &a.id)?;
    assert_eq!(
        projected
            .iter()
            .filter_map(|row| row["id"].as_str())
            .collect::<Vec<_>>(),
        [&b.id, &a.id]
    );
    Ok(())
}
