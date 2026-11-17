//! Actual Engine effects on deterministic signed data; no public network.
#![allow(clippy::expect_used)]
#[path = "read-score/driver.rs"]
mod driver;
#[path = "read-score/fixture.rs"]
mod fixture;
#[path = "read-score/stats.rs"]
mod stats;
use sha2::{Digest, Sha256};
fn main() {
    let fixture = fixture::Fixture::new();
    let mut cold = driver::run(&fixture, None, 0);
    let mut quality = cold.engine.network.quality_json(fixture::START + 20_000);
    let warm = driver::warm(&fixture, &cold.engine);
    cold.report["warmStoreReplay"] = warm.report;
    let mut week = Vec::new();
    for day in 1..=7 {
        let run = driver::run(&fixture, Some(&quality), day);
        quality = run
            .engine
            .network
            .quality_json(fixture::START + day * 86_400_000 + 20_000);
        week.push(run.report);
    }
    let digest = |v: &serde_json::Value| format!("{:x}", Sha256::digest(v.to_string().as_bytes()));
    let workload = serde_json::json!({"relays":fixture.relays,"events":fixture.events,
        "initialStore":fixture.seed,"queries":fixture.queries,"trace":fixture.trace});
    cold.report["workloadHash"] = serde_json::json!(digest(&workload));
    cold.report["witnessHash"] = serde_json::json!(digest(&serde_json::json!(cold.stats.wanted)));
    cold.report["initialStoreHash"] =
        serde_json::json!(digest(&serde_json::json!(cold.stats.held)));
    cold.report["complete"] = serde_json::json!(true);
    cold.report["traceHash"] = serde_json::json!(digest(&fixture.trace));
    cold.report["fixture"] = serde_json::json!({"relays":32,"authors":300,"openViews":5,
        "history":"seven deterministic daily Engine-input sessions; relay quality persisted; reader-learning unsupported by baseline remains observable"});
    cold.report["weekReplay"] = serde_json::json!(week);
    println!("{}", cold.report);
    assert!(cold.stats.requests > 0 && cold.stats.wire_events > 0);
    assert_eq!(
        cold.report["recall"]["obtained"],
        cold.report["recall"]["wanted"]
    );
}
