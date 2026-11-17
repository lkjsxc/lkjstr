//! Cache corruption retires authority, without preventing unrelated event commits.
use super::*;

/// Strict reads still report corruption. A writer may repair it only in the
/// event transaction, with a fresh epoch: old rendered counts cannot silently
/// adopt a partial zero from the replacement context.
pub fn recover_contexts(
    previous: Option<&str>,
    incoming: &[Context],
    deletions: &[Record],
    seed: &str,
    limits: Limits,
) -> Result<String, &'static str> {
    if let Some(raw) = previous.filter(|raw| merge::checkpoint(raw).is_err()) {
        if !lkjstr_protocol::is_event_id(seed) {
            return Err("read context recovery epoch missing");
        }
        // Domain separation also prevents lineage reuse with a deterministic
        // test seed. Browser writers supply a fresh random seed every time.
        let mut digest = Sha256::new();
        digest.update(b"lkjstr-read-context-recovery-1");
        digest.update(seed.as_bytes());
        digest.update(raw.as_bytes());
        let epoch = lkjstr_protocol::bytes_to_hex(&digest.finalize());
        merge_contexts(None, incoming, deletions, &epoch, limits)
    } else {
        merge_contexts(previous, incoming, deletions, seed, limits)
    }
}
