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

#[test]
fn quiet_visitor_global_keeps_a_preview_around_its_latest_note() {
    let now = 1_800_000_000_000;
    let key = generate_secret_key();
    let sign = |created_at, text: &str| {
        finalize_event(
            &EventTemplate {
                pubkey: None,
                created_at,
                kind: 1,
                content: text.into(),
                tags: vec![],
            },
            &key,
        )
        .expect("signed note")
    };
    let old = sign(1_700_000_000, "old note from a quiet relay");
    let earlier = sign(old.created_at - 86_401, "older than the fallback window");
    let recent = sign(now / 1000 - 3, "new arrival");
    let open = |engine: &mut Engine, sub: &str, account, since| {
        engine.input(
            Input::Open {
                sub: sub.into(),
                query: Query {
                    source: Source::Global,
                    account,
                    filters: protocol::Filters {
                        since,
                        ..Default::default()
                    },
                    ..Default::default()
                },
            },
            now,
        );
    };
    let mut engine = Engine::new();
    open(&mut engine, "quiet", None, None);
    open(&mut engine, "signed-in", Some(old.pubkey.clone()), None);
    open(&mut engine, "period", None, Some(old.created_at + 1));
    assert!(engine.views["quiet"].rows.is_empty());

    engine.enqueue("wss://quiet.test/".into(), old.clone());
    engine.enqueue("wss://quiet.test/".into(), earlier);
    engine.tick(now + 75);
    assert_eq!(engine.views["quiet"].rows.len(), 1);
    assert_eq!(engine.views["quiet"].rows[0].id, old.id);
    assert!(engine.views["signed-in"].rows.is_empty());
    assert!(engine.views["period"].rows.is_empty());

    engine.enqueue("wss://quiet.test/".into(), recent.clone());
    engine.tick(now + 150);
    assert_eq!(engine.views["quiet"].rows[0].id, recent.id);
    assert_eq!(engine.views["quiet"].rows[1].id, old.id);
    open(&mut engine, "recent-first", None, None);
    assert_eq!(engine.views["recent-first"].rows.len(), 1);
    assert_eq!(engine.views["recent-first"].rows[0].id, recent.id);
}
