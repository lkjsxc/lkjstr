#![allow(clippy::expect_used)]
use lkjstr_core::{cache::Record, engine::Engine, persistence::PendingEvents};
use lkjstr_protocol::{
    EventTemplate, NostrEvent, VerificationResult, finalize_event, generate_secret_key,
    verify_event,
};

fn event(at: u64, tags: Vec<Vec<String>>) -> NostrEvent {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: at,
            kind: 1,
            tags,
            content: String::new(),
        },
        &generate_secret_key(),
    )
    .expect("signed liveness fixture")
}

fn legacy(event: &NostrEvent) -> Record {
    let mut record = Record::verified(event).expect("compact fixture");
    record.receipt = None;
    record
}

#[test]
fn impossible_dense_tags_cannot_block_direct_or_legacy_cache_verification() {
    let oversized = event(1, vec![vec![String::new(); 525_000]]);
    let normal = event(2, vec![]);
    assert!(matches!(
        verify_event(&oversized),
        VerificationResult::Ok(_)
    ));
    assert!(!PendingEvents::default().can_admit(&oversized));
    assert!(lkjstr_core::store::event_payload_bytes(&oversized) < 1024);
    let cached = legacy(&oversized);
    assert!(cached.raw.len() < 2 * 1024 * 1024);

    let mut direct = Engine::new();
    direct.enqueue("wss://fixture.invalid/".into(), oversized);
    direct.enqueue("wss://fixture.invalid/".into(), normal.clone());
    direct.tick(3_000);
    assert_eq!(direct.dropped, 1);
    assert_eq!(direct.verified, 1);
    assert_eq!(direct.store.get(&normal.id).as_deref(), Some(&normal));
    assert!(!direct.network.verifying);

    let mut restored = Engine::new();
    restored.restore_cache(&[cached, legacy(&normal)]);
    restored.tick(3_000);
    assert_eq!(restored.dropped, 1);
    assert_eq!(restored.verified, 1);
    assert_eq!(restored.store.get(&normal.id).as_deref(), Some(&normal));
    assert!(!restored.network.verifying);
    assert!(!restored.cached_history_complete);
}

#[test]
fn ordinary_ingress_waits_for_temporary_queue_pressure_then_resumes() {
    let filler = event(1, vec![]);
    let normal = event(2, vec![]);
    let mut engine = Engine::new();
    engine.store.insert(filler.clone(), None);
    let filler = engine.store.lease(&filler.id).expect("filler lease");
    for _ in 0..20_000 {
        assert!(engine.pending.push_lease(filler.clone()));
    }
    assert!(!engine.pending.can_admit(&normal));
    engine.enqueue("wss://fixture.invalid/".into(), normal.clone());
    engine.tick(3_000);
    assert_eq!(engine.dropped, 0);
    assert_eq!(engine.verified, 0);
    assert!(engine.network.verifying);
    assert!(engine.store.get(&normal.id).is_none());
    let committed = engine.pending.batch();
    engine.pending.committed(&committed);
    assert!(engine.pending.can_admit(&normal));
    engine.tick(4_000);
    assert_eq!(engine.verified, 1);
    assert_eq!(engine.store.get(&normal.id).as_deref(), Some(&normal));
    assert!(!engine.network.verifying);
}
