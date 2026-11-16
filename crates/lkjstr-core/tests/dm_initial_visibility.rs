use lkjstr_core::engine::wire::Input;
#[test]
fn private_open_accepts_atomic_visibility_and_keeps_the_old_default()
-> Result<(), Box<dyn std::error::Error>> {
    for visible in [None, Some(false), Some(true)] {
        let mut input = serde_json::json!({
            "t": "dm.open", "sub": "hidden", "query": { "account": "a".repeat(64) }
        });
        if let Some(visible) = visible {
            input["visible"] = visible.into();
        }
        let Input::DmOpen {
            visible: parsed, ..
        } = serde_json::from_value(input)?
        else {
            return Err("private open was not decoded".into());
        };
        assert_eq!(parsed.unwrap_or(true), visible.unwrap_or(true));
    }
    Ok(())
}
