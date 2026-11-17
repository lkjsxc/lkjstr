#![allow(dead_code)]
use lkjstr_core::{
    cache::{
        Record,
        context::{Context, Limits, merge_contexts, read_contexts},
    },
    engine::Engine,
    store::Store,
};
use lkjstr_protocol::{EventTemplate, NostrEvent, SecretKeyBytes, finalize_event};
pub type Result = std::result::Result<(), Box<dyn std::error::Error>>;
pub fn event(
    key: &SecretKeyBytes,
    kind: u64,
    at: u64,
    content: &str,
    tags: Vec<Vec<String>>,
) -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            kind,
            created_at: at,
            content: content.into(),
            tags,
        },
        key,
    )
    .expect("signed public context fixture")
}
pub fn target(key: &SecretKeyBytes, at: u64) -> NostrEvent {
    event(key, 1, at, "read before", vec![])
}
pub fn related(key: &SecretKeyBytes, target: &NostrEvent, kind: u64, at: u64) -> NostrEvent {
    event(
        key,
        kind,
        at,
        "+",
        vec![vec![
            "e".into(),
            target.id.clone(),
            String::new(),
            "reply".into(),
        ]],
    )
}
pub fn capture(store: &Store, id: &str, seen: u64) -> Context {
    Context::capture(store, id, seen)
        .expect("capture valid")
        .expect("retained note")
}
pub fn merge(
    previous: Option<&str>,
    incoming: &[Context],
    deletions: &[Record],
) -> std::result::Result<String, &'static str> {
    merge_contexts(
        previous,
        incoming,
        deletions,
        &"1".repeat(64),
        Limits::default(),
    )
}
pub fn restore(raw: &str) -> Engine {
    let mut engine = Engine::new();
    for context in read_contexts(Some(raw)).expect("valid contexts") {
        engine.restore_cache(&context.rows);
    }
    engine
}
