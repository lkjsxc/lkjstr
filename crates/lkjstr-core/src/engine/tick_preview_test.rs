#![allow(clippy::expect_used)]

use super::*;
use crate::engine::protocol::Source;
use lkjstr_protocol::{EventTemplate, finalize_event, generate_secret_key};

#[test]
fn first_verified_preview_renders_before_the_next_batch() {
    let now = 1_800_000_000_000;
    let key = generate_secret_key();
    let sign = |text: &str| {
        finalize_event(
            &EventTemplate {
                pubkey: None,
                created_at: now / 1000,
                kind: 1,
                content: text.into(),
                tags: vec![],
            },
            &key,
        )
        .expect("signed note")
    };
    let first = sign("first preview note");
    let mut engine = Engine::new();
    engine.input(
        Input::Open {
            sub: "home".into(),
            query: Query {
                source: Source::Home,
                account: Some(first.pubkey.clone()),
                ..Default::default()
            },
        },
        now,
    );
    engine.tick(now + 75);
    assert!(engine.views["home"].rows.is_empty());
    engine.enqueue("cache".into(), first.clone());
    engine.tick(now + 100);
    assert_eq!(engine.views["home"].rows[0].id, first.id);
    assert_eq!(engine.last_flush, now + 75);

    engine.enqueue("cache".into(), sign("next preview note"));
    engine.tick(now + 125);
    assert_eq!(engine.views["home"].rows.len(), 1);
    engine.tick(now + 150);
    assert_eq!(engine.views["home"].rows.len(), 2);
}
