#![allow(clippy::expect_used, clippy::panic)]
use lkjstr_core::engine::{
    Engine,
    protocol::{Action, Input, Output, Query, Source},
    rows::Segment,
};
use lkjstr_protocol::{
    EventTemplate, NostrEvent, UnsignedNostrEvent, finalize_event, generate_secret_key,
    public_key_from_secret,
};
fn event(at: u64, kind: u64, content: &str, tags: Vec<Vec<String>>) -> NostrEvent {
    let key = generate_secret_key();
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: at,
            kind,
            tags,
            content: content.into(),
        },
        &key,
    )
    .expect("signed fixture")
}
fn open(e: &mut Engine, sub: &str, source: Source) {
    e.input(
        Input::Open {
            sub: sub.into(),
            query: Query {
                source,
                ..Default::default()
            },
        },
        0,
    );
}
fn ingest(e: &mut Engine, event: NostrEvent, at: u64) {
    e.enqueue("wss://local.test/".into(), event);
    e.tick(at);
}
#[test]
fn structured_messages_roundtrip_and_bad_input_is_rejected() {
    let input: Input =
        serde_json::from_str(r#"{"type":"open","sub":"a","query":{"source":"global"}}"#)
            .expect("contract");
    let mut e = Engine::new();
    e.input(input, 0);
    let output = e.drain();
    assert!(matches!(
        output.first(),
        Some(Output::Rows {
            at_top: true,
            at_bottom: false,
            ..
        })
    ));
    assert!(serde_json::from_str::<Input>(r#"{"type":"window","sub":"a","before":-1}"#).is_err());
    assert!(serde_json::to_string(&output).is_ok());
}
#[test]
fn rows_are_finished_and_patches_are_batched() {
    let mut e = Engine::new();
    open(&mut e, "a", Source::Global);
    e.drain();
    let note = event(
        5,
        1,
        "日本語 :cat: https://example.test/image.png",
        vec![
            vec![
                "emoji".into(),
                "cat".into(),
                "https://example.test/cat.png".into(),
            ],
            vec![
                "imeta".into(),
                "url https://example.test/image.png".into(),
                "dim 640x480".into(),
                "alt cat".into(),
            ],
        ],
    );
    ingest(&mut e, note, 1);
    assert!(e.drain().is_empty());
    e.tick(75);
    let out = e.drain();
    let Output::Patch { ops, .. } = &out[0] else {
        panic!("patch expected")
    };
    let lkjstr_core::engine::protocol::Patch::Upsert { item, .. } = &ops[0] else {
        panic!("upsert")
    };
    assert!(
        item.content
            .iter()
            .any(|p| matches!(p,Segment::Emoji{code,..} if code=="cat"))
    );
    assert!(item.content.iter().any(|p| matches!(
        p,
        Segment::Media {
            width: Some(640),
            height: Some(480),
            ..
        }
    )));
    assert!(item.counts.partial);
    assert!(!item.author.nip05_verified);
}
#[test]
fn anchored_window_holds_identity_and_new_items_emit_fresh() {
    let mut e = Engine::new();
    e.signed_out_global_filter = false;
    let mut ids = vec![];
    for at in 1..=5 {
        let n = event(at, 1, "hello", vec![]);
        ids.push(n.id.clone());
        ingest(&mut e, n, at);
    }
    open(&mut e, "a", Source::Global);
    e.drain();
    e.input(
        Input::Window {
            sub: "a".into(),
            anchor: Some(ids[2].clone()),
            before: 0,
            after: 1,
        },
        100,
    );
    let out = e.drain();
    assert!(
        matches!(&out[0],Output::Rows{items,at_top:false,..} if items.len()==2 && items[0].id==ids[2])
    );
    ingest(&mut e, event(6, 1, "new", vec![]), 150);
    let out = e.drain();
    assert!(!out.iter().any(|o| matches!(o, Output::Patch { .. })));
    assert!(
        out.iter()
            .any(|o| matches!(o, Output::Fresh { count: 3, .. }))
    );
}
#[test]
fn unloaded_lists_never_get_clobbered_and_signer_substitution_fails() {
    let mut e = Engine::new();
    let key = generate_secret_key();
    let account = public_key_from_secret(&key).expect("public");
    e.input(
        Input::Action {
            req: "f".into(),
            account: account.clone(),
            action: Action::Follow {
                pubkey: "a".repeat(64),
                value: true,
            },
        },
        0,
    );
    assert!(matches!(&e.drain()[0],Output::Error{code,..} if code=="list-not-loaded"));
    e.input(
        Input::Action {
            req: "n".into(),
            account: account.clone(),
            action: Action::Publish {
                kind: "note".into(),
                content: "original".into(),
                target: None,
                tags: vec![],
            },
        },
        0,
    );
    let output = e.drain();
    let Output::Sign {
        event: requested, ..
    } = &output[0]
    else {
        panic!("sign")
    };
    let changed = UnsignedNostrEvent {
        content: "substitution".into(),
        ..requested.clone()
    };
    let signed = lkjstr_protocol::event_sign::sign_event_with_secret_hex(&changed, "00");
    assert!(signed.is_err());
    let changed = finalize_event(
        &EventTemplate {
            pubkey: Some(account),
            created_at: changed.created_at,
            kind: changed.kind,
            tags: changed.tags,
            content: changed.content,
        },
        &key,
    )
    .expect("signed");
    e.input(
        Input::Signed {
            req: "n".into(),
            event: Some(changed),
            error: None,
        },
        1,
    );
    assert!(matches!(&e.drain()[0],Output::Error{code,..} if code=="invalid-signer-response"));
}
#[test]
fn invalid_events_and_duplicate_work_are_bounded() {
    let mut e = Engine::new();
    let good = event(1, 1, "ok", vec![]);
    let mut bad = good.clone();
    bad.content = "tampered".into();
    ingest(&mut e, bad, 1);
    assert_eq!(e.rejected, 1);
    assert!(e.store.is_empty());
    for _ in 0..100 {
        e.enqueue("local".into(), good.clone());
    }
    e.tick(75);
    assert_eq!(e.verified, 1);
    assert_eq!(e.store.len(), 1);
}
