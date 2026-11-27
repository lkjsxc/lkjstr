#![allow(clippy::expect_used)]
use super::*;
use crate::store::Store;
use lkjstr_protocol::{EventTemplate, finalize_event, generate_secret_key};

#[test]
fn verified_compact_control_crosses_a_resident_proof_floor_behind_ordinary_ingress() {
    let secret = generate_secret_key();
    let targets: Vec<_> = (100..105)
        .map(|id| vec!["e".to_owned(), format!("{id:064x}")])
        .collect();
    let sign = |at, tags, content| {
        finalize_event(
            &EventTemplate {
                pubkey: None,
                created_at: at,
                kind: 5,
                tags,
                content,
            },
            &secret,
        )
        .expect("signed control")
    };
    let mut engine = Engine::new();
    assert!(!engine.verification_ready());
    engine.store = Store::with_caps(4, 4).weight_retention();
    for (i, target) in targets.iter().enumerate() {
        engine.store.insert_deferred(
            sign(1 + i as u64, vec![target.clone()], "large".repeat(100)),
            None,
        );
    }
    assert!(engine.store.pressure_admission_paused());
    for id in 1000..1600 {
        let event = lkjstr_protocol::NostrEvent {
            id: format!("{id:064x}"),
            pubkey: "a".repeat(64),
            created_at: 1,
            kind: 1,
            tags: vec![],
            content: "blocked optional".into(),
            sig: "b".repeat(128),
        };
        engine.enqueue("test".into(), event);
    }
    let replacement = sign(10, targets, String::new());
    engine.enqueue("test".into(), replacement.clone());
    assert!(!engine.verification_ready());
    engine.tick(20_000);
    assert_eq!(engine.verified, 0);
    engine.tick(20_100);
    assert_eq!(engine.verified, 0);
    engine.tick(20_200);
    assert_eq!(
        engine.verified, 1,
        "the third bounded scan reaches and verifies the reducing control"
    );
    assert!(engine.store.lease(&replacement.id).is_some());
    assert!(!engine.store.pressure_admission_paused());
    assert!(engine.verification_ready());
    assert_eq!(engine.pending.len(), 1);
}
