//! Cross-Worker archive guards contain no account secrets or private draft bodies.
use super::{generation, storage_key};
use serde::Deserialize;
#[derive(Deserialize)]
struct Saved {
    entries: Vec<Identity>,
}
#[derive(Deserialize)]
struct Identity {
    pubkey: String,
    signer: String,
}
pub fn saved_account(raw: &str, account: &str) -> Result<(), &'static str> {
    storage_key(account)?;
    if raw.len() > 16 * 1024 * 1024 {
        return Err("too-large");
    }
    let saved: Saved = serde_json::from_str(raw).map_err(|_| "internal")?;
    if saved.entries.len() > 32 {
        return Err("too-large");
    }
    let identity = saved
        .entries
        .iter()
        .find(|a| a.pubkey == account)
        .ok_or("signed-out")?;
    match identity.signer.as_str() {
        "local" | "extension" | "remote" => Ok(()),
        "none" => Err("read-only"),
        _ => Err("unsupported"),
    }
}
/// Generation is pinned at the initial read, never refreshed during conflict retries.
pub fn compare(
    expected_generation: &str,
    current_generation: Option<&str>,
    expected: Option<&str>,
    current: Option<&str>,
) -> Result<bool, &'static str> {
    if !generation(expected_generation) || current_generation != Some(expected_generation) {
        return Err("rejected");
    }
    Ok(expected == current)
}

/// Append to the same transaction as account removal; one global nonce bounds metadata.
pub fn removal_rows(
    account: &str,
    nonce: String,
) -> Result<Vec<(String, Option<String>)>, &'static str> {
    if !generation(&nonce) {
        return Err("rejected");
    }
    Ok(vec![
        (storage_key(account)?, None),
        (super::GENERATION_KEY.into(), Some(nonce)),
    ])
}
