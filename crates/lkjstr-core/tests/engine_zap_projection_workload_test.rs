#![allow(clippy::unwrap_used)]
// Opt-in measured projection workload; signing/setup is outside the timed region.
#[path = "engine_zaps/common/mod.rs"]
mod common;
use common::*;
use lkjstr_core::{
    engine::zaps::{Phase, Providers, Receipts, Target},
    store::Store,
};
use std::time::Instant;

#[test]
#[ignore = "manual receipt-projection measurement; records timings without a flaky threshold"]
fn receipt_projection_workload() {
    const NOTES: usize = 800;
    const PER_NOTE: usize = 19;
    const ROUNDS: usize = 3;
    let mut store = Store::with_caps(NOTES * (PER_NOTE + 1), 8);
    profile(&mut store, 2, "fixture@ln.test", 1);
    let recipient = key(2).public_key();
    let mut targets = Vec::with_capacity(NOTES);
    for i in 0..NOTES {
        let note = event(2, 1, vec![], &format!("fixture note {i}"), 10);
        targets.push(Target::Event {
            id: note.id.clone(),
        });
        store.insert(note, None);
    }
    let mut ids = Vec::with_capacity(NOTES * PER_NOTE);
    for (i, target) in targets.iter().enumerate() {
        let Target::Event { id } = target else {
            unreachable!();
        };
        for j in 0..PER_NOTE {
            // Correct outer signatures can reach the raw event cache before a
            // provider is resolved. Missing invoice fields never become money.
            let raw = event(
                4,
                9735,
                vec![tag(&["p", &recipient]), tag(&["e", id])],
                &format!("unresolved fixture {i}:{j}"),
                20,
            );
            ids.push(raw.id.clone());
            store.insert(raw, None);
        }
    }
    let providers = Providers::default();
    let mut receipts = Receipts::default();
    receipts.sync(&store, &providers, &ids, 100).unwrap();
    assert_eq!(receipts.len(), NOTES * PER_NOTE);
    let began = Instant::now();
    let mut unresolved = 0;
    for _ in 0..ROUNDS {
        for target in &targets {
            let total = receipts.total(&store, &providers, target, 100);
            assert_eq!(total.amount_msat, "0");
            assert_eq!(total.receipts, 0);
            assert_eq!(total.phase, Phase::Loading);
            unresolved += total.unverified;
        }
    }
    let elapsed = began.elapsed().as_secs_f64() * 1000.0;
    assert_eq!(unresolved, NOTES * PER_NOTE * ROUNDS);
    println!(
        "{}",
        serde_json::json!({
            "notes": NOTES,
            "receiptCandidates": receipts.len(),
            "rounds": ROUNDS,
            "projectionMs": elapsed,
            "msPer800Notes": elapsed / ROUNDS as f64,
            "unverifiedPerNote": PER_NOTE
        })
    );
}
