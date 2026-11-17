//! Compare only reports with identical fixture identity and simulation semantics.
use super::fixture::Failure;
use serde_json::{Value, json};
use std::{fs::File, io::Read};

pub fn report(path: &str, current: &Value) -> Result<Value, Failure> {
    let mut bytes = String::new();
    File::open(path)?
        .take(16 * 1024 * 1024 + 1)
        .read_to_string(&mut bytes)?;
    if bytes.len() > 16 * 1024 * 1024 {
        return Err("baseline exceeds 16 MiB".into());
    }
    let before: Value = serde_json::from_str(&bytes)?;
    if before["schema"] != current["schema"]
        || before["fixtureFingerprint"] != current["fixtureFingerprint"]
        || before["simulation"] != current["simulation"]
    {
        return Err("baseline has a different fixture or simulation contract".into());
    }
    let mut changes = vec![];
    for order in ["declared", "reversed"] {
        let old = before["runs"]
            .as_array()
            .and_then(|runs| runs.iter().find(|run| run["openOrder"] == order));
        let new = current["runs"]
            .as_array()
            .and_then(|runs| runs.iter().find(|run| run["openOrder"] == order));
        if old.is_none() && new.is_none() {
            continue;
        }
        let (Some(old), Some(new)) = (old, new) else {
            return Err("baseline is missing a matching workload run".into());
        };
        for metric in [
            "recall",
            "requests",
            "logicalFiltersSent",
            "connectAttempts",
            "peakSockets",
            "peakSubscriptions",
            "duplicateWireEvents",
            "bytesIn",
            "bytesOut",
            "requestsPerObtainedWantedNewEvent",
            "connectionsPerObtainedWantedNewEvent",
            "duplicatesPerObtainedWantedNewEvent",
            "firstScreenVerifiedReadySimulatedMs",
        ] {
            let pair = old[metric].as_f64().zip(new[metric].as_f64());
            let (delta, percent) = pair.map_or((None, None), |(a, b)| {
                (Some(b - a), (a != 0.0).then(|| (b - a) / a.abs() * 100.0))
            });
            changes.push(json!({"openOrder":order, "metric":metric,
                "before":old[metric], "after":new[metric],
                "absoluteChange":delta, "relativeChangePercent":percent,
                "preferredDirection":if metric == "recall" { "up" } else { "down" }}));
        }
    }
    Ok(
        json!({"baselineLabel":before["label"], "candidateLabel":current["label"],
        "changes":changes,
        "decision":"No automatic keep/stop decision: preserve recall and measure the browser paint guard separately."}),
    )
}
