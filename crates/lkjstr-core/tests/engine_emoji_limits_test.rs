use lkjstr_core::engine::{Engine, wire};
use lkjstr_protocol::{
    EventTemplate, NostrEvent, SecretKeyBytes, finalize_event, generate_secret_key,
};
use serde_json::{Value, json};
type Result<T = ()> = std::result::Result<T, Box<dyn std::error::Error>>;

fn event(key: &SecretKeyBytes, kind: u64, tags: Vec<Vec<String>>) -> Result<NostrEvent> {
    Ok(finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: 20,
            kind,
            content: String::new(),
            tags,
        },
        key,
    )
    .map_err(|_| "fixture signing")?)
}
fn projection(tags: Vec<Vec<String>>, identifier: Option<&str>) -> Result<Value> {
    let mut engine = Engine::new();
    let owner = generate_secret_key();
    let list_tags = if let Some(identifier) = identifier {
        let mut set_tags = vec![vec!["d".into(), identifier.into()]];
        set_tags.extend(tags);
        let set = event(&generate_secret_key(), 30030, set_tags)?;
        let reference = format!("30030:{}:{identifier}", set.pubkey);
        engine.store.insert(set, None);
        vec![vec!["a".into(), reference]]
    } else {
        tags
    };
    let list = event(&owner, 10030, list_tags)?;
    let account = list.pubkey.clone();
    engine.store.insert(list, None);
    let mut session = wire::Session::default();
    for value in [
        json!({"t":"open","sub":"emoji","query":{"source":"emoji","account":account}}),
        json!({"t":"window","sub":"emoji","anchor":"top","before":0,"after":400}),
    ] {
        for input in session
            .input(serde_json::from_value(value)?, &engine)
            .map_err(|_| "wire input")?
        {
            engine.input(input, 100_000);
        }
    }
    let mut rows = None;
    for output in engine.drain() {
        for output in session.output(output, &engine) {
            let output = serde_json::to_value(output)?;
            if output["t"] == "rows" {
                rows = Some(output);
            }
        }
    }
    rows.ok_or_else(|| "missing rows".into())
}
fn emoji(code: &str, url: &str) -> Vec<Vec<String>> {
    vec![vec!["emoji".into(), code.into(), url.into()]]
}
fn url(bytes: usize) -> String {
    let prefix = "https://images.test/";
    format!("{prefix}{}", "x".repeat(bytes - prefix.len()))
}
fn incomplete(rows: Value) -> Result {
    assert!(rows["rows"].as_array().ok_or("rows")?.is_empty());
    assert_eq!(
        rows["atBottom"], false,
        "a skipped bounded item is not completed empty membership"
    );
    Ok(())
}
#[test]
fn lone_over_budget_coordinate_remains_incomplete() -> Result {
    incomplete(projection(emoji("wave", &url(40)), Some(&"d".repeat(257)))?)
}
#[test]
fn lone_direct_over_budget_shortcode_remains_incomplete() -> Result {
    incomplete(projection(emoji(&"s".repeat(65), &url(40)), None)?)
}
#[test]
fn lone_referenced_over_budget_shortcode_remains_incomplete() -> Result {
    incomplete(projection(emoji(&"s".repeat(65), &url(40)), Some("pack"))?)
}
#[test]
fn lone_direct_over_budget_url_remains_incomplete() -> Result {
    incomplete(projection(emoji("wave", &url(2049)), None)?)
}
#[test]
fn lone_referenced_over_budget_url_remains_incomplete() -> Result {
    incomplete(projection(emoji("wave", &url(2049)), Some("pack"))?)
}
#[test]
fn exact_value_boundaries_remain_complete() -> Result {
    for identifier in [None, Some("d".repeat(256))] {
        let rows = projection(emoji(&"s".repeat(64), &url(2048)), identifier.as_deref())?;
        assert_eq!(rows["rows"].as_array().ok_or("rows")?.len(), 1);
        assert_eq!(rows["atBottom"], true);
    }
    Ok(())
}
#[test]
fn invalid_small_values_and_recursive_references_are_not_resource_truncation() -> Result {
    let mut tags = emoji("not a shortcode", "javascript:invalid");
    tags.push(vec![
        "a".into(),
        format!("30030:{}:{}", "a".repeat(64), "d".repeat(257)),
    ]);
    let rows = projection(tags, Some("pack"))?;
    assert!(rows["rows"].as_array().ok_or("rows")?.is_empty());
    assert_eq!(rows["atBottom"], true);
    Ok(())
}
