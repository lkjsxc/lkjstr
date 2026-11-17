//! Hash runtime source snapshots captured by rustc, never files read after execution.
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

pub fn report() -> Value {
    let sources = [
        (
            "src/engine/network.rs",
            include_str!("../../src/engine/network.rs"),
        ),
        (
            "src/engine/network_plan.rs",
            include_str!("../../src/engine/network_plan.rs"),
        ),
        (
            "src/engine/network_messages.rs",
            include_str!("../../src/engine/network_messages.rs"),
        ),
        (
            "src/engine/request_policy.rs",
            include_str!("../../src/engine/request_policy.rs"),
        ),
        (
            "src/engine/wants.rs",
            include_str!("../../src/engine/wants.rs"),
        ),
    ];
    let hashes: BTreeMap<_, _> = sources
        .into_iter()
        .map(|(path, source)| (path, format!("{:x}", Sha256::digest(source.as_bytes()))))
        .collect();
    let mut aggregate = Sha256::new();
    for (path, digest) in &hashes {
        aggregate.update(path.as_bytes());
        aggregate.update([0]);
        aggregate.update(digest.as_bytes());
        aggregate.update(b"\n");
    }
    json!({
        "cargoManifestDir":env!("CARGO_MANIFEST_DIR"),
        "capture":"compile-time include_str",
        "algorithm":"SHA-256",
        "runtimeSourceSha256":hashes,
        "runtimeSourceSetSha256":format!("{:x}", aggregate.finalize()),
        "aggregateEncoding":"Sorted relative path, NUL, lowercase SHA-256 hex, LF for each source.",
        "scope":"The five named runtime files; retain revision and driver identity separately."
    })
}
