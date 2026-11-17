//! Read-only native Q1/Q5 measurement. No external network, signer, or browser access.
#[path = "read_scorecard/compare.rs"]
mod compare;
#[path = "read_scorecard/fixture.rs"]
mod fixture;
#[path = "read_scorecard/metrics.rs"]
mod metrics;
#[path = "read_scorecard/provenance.rs"]
mod provenance;
#[path = "read_scorecard/replay.rs"]
mod replay;
#[path = "read_scorecard/transport.rs"]
mod transport;
#[path = "read_scorecard/witness.rs"]
mod witness;
use fixture::{Failure, Fixture};
use serde_json::{Value, json};

fn main() -> Result<(), Failure> {
    let mut label = String::from("unlabelled");
    let mut baseline = None;
    let mut require_union = false;
    let mut witness_only = false;
    let mut arguments = std::env::args().skip(1);
    while let Some(argument) = arguments.next() {
        match argument.as_str() {
            "--label" => label = arguments.next().ok_or("--label needs a value")?,
            "--baseline" => baseline = Some(arguments.next().ok_or("--baseline needs a path")?),
            "--require-union" => require_union = true,
            "--witness-only" => witness_only = true,
            "--help" => {
                println!(
                    "engine-read-scorecard [--label REV] [--baseline REPORT.json] [--require-union] [--witness-only]"
                );
                return Ok(());
            }
            _ => return Err(format!("unknown argument: {argument}").into()),
        }
    }
    let fixture = Fixture::new()?;
    let raw = witness::run(false)?;
    let normalized = witness::run(true)?;
    let strict_pass = raw["passesExactEquivalentUnion"] == true
        && normalized["passesExactEquivalentUnion"] == true;
    let runs = if witness_only {
        vec![]
    } else {
        vec![replay::run(&fixture, false)?, replay::run(&fixture, true)?]
    };
    let mut report = json!({
        "schema":"lkjstr.read-scorecard.v1", "label":label,
        "buildProvenance":provenance::report(),
        "fixtureFingerprint":fixture.fingerprint,
        "fixture":{"relays":fixture::RELAYS, "authors":fixture::AUTHORS,
            "visibleWants":5, "groundTruthWantedEvents":fixture.wanted.len(),
            "initialContextEvents":fixture.context.len(),
            "origin":"engine_read_simulation_test distribution; real signed events and Engine effects"},
        "simulation":{"horizonMs":fixture::HORIZON, "tickMs":10, "handshakeMs":20,
            "eventSpacingMs":1, "maxFilters":2, "maxSubscriptions":4,
            "profileCloseMs":12000, "profileReopenMs":13000,
            "publicContextAvailableOn":"every fixture relay"},
        "runs":runs,
        "exactEquivalentOwnership":{"raw":raw, "normalizedControl":normalized},
        "historyReplay":{"status":"not-implemented", "recordedWeek":Value::Null},
        "publicRelayMeasurement":Value::Null,
        "measurementLimits":[
            "Native simulation; no public-relay performance or rendered first-paint claim.",
            "Bytes count actual protocol UTF-8 frames; TLS, WebSocket and NIP-11 HTTP overhead are not measured.",
            "The engine may admit fewer than 32 configured candidates; report actual admission and connections.",
            "Zero-new-wanted requests include legitimate empty counts and metadata evidence; they are not all waste.",
            "Screens require verified stored IDs for the newest ten eligible events per want, or fewer when none exist.",
            "Recorded reader behavior and persisted weekly learning are not fabricated or replayed here.",
            "A normalized input control is not a runtime implementation or proof of finite subset coverage."
        ]
    });
    if let Some(path) = baseline {
        report["comparison"] = compare::report(&path, &report)?;
    }
    println!("{}", serde_json::to_string_pretty(&report)?);
    if require_union && !strict_pass {
        return Err("exact-equivalent ownership witness failed".into());
    }
    Ok(())
}
