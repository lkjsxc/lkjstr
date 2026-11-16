use lkjstr_core::engine::{Engine, storage_inspection::{Count, Memory, Origin, Report}, wire::{Input, Output, Session}};
#[test]
fn additive_storage_messages_parse_without_becoming_relay_inputs() -> Result<(), Box<dyn std::error::Error>> {
    let engine = Engine::new(); let mut session = Session::default();
    for tag in ["storage.inspect", "storage.close"] {
        let input: Input = serde_json::from_value(serde_json::json!({"t":tag,"req":"owned"}))?;
        assert!(session.input(input, &engine).map_err(|_| "wire error")?.is_empty());
    }
    let old: Input = serde_json::from_str(r#"{"t":"stats","req":"old"}"#)?;
    assert!(matches!(old, Input::Stats { req } if req == "old"));
    Ok(())
}
#[test]
fn unknown_components_have_no_guessed_counts_or_bytes() -> Result<(), Box<dyn std::error::Error>> {
    let value = serde_json::to_value(Output::Storage { req: "owned".into(), report: Report {
        started_at: 12, finished_at: 13, memory: Memory { events: 0, event_payload_bytes: 0, at: 12 },
        persisted_events: Count::Unsupported, origin: Origin::Failed,
    } })?;
    assert_eq!(value["report"]["persistedEvents"], serde_json::json!({"phase":"unsupported"}));
    assert_eq!(value["report"]["origin"], serde_json::json!({"phase":"failed"}));
    assert_eq!(value["report"]["memory"]["eventPayloadBytes"], 0);
    assert!(value["report"].get("cacheBytes").is_none());
    Ok(())
}
